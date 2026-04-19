import asyncio
import re
import os
import json
import subprocess
from datetime import datetime, timedelta
from icalendar import Calendar
import requests
from playwright.async_api import async_playwright
from twilio.rest import Client


# Credentials from environment variables
USERNAME = os.getenv("HYPERPLANNING_USERNAME", "")
PASSWORD = os.getenv("HYPERPLANNING_PASSWORD", "")
ICS_URL = os.getenv("ICS_URL", "")
HYPERPLANNING_URL = "https://estiam-planning2026.hyperplanning.fr/hp/etudiant"

# Twilio
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "")
WHATSAPP_TO = os.getenv("WHATSAPP_TO", "")


def get_current_and_next_week():
    """Retourne le numéro de la semaine en cours et la suivante."""
    today = datetime.now()
    week_num = today.isocalendar()[1]
    return week_num, week_num + 1


def parse_ics_file(ics_content: str) -> dict:
    """Parse le fichier ICS et retourne les cours groupés par semaine."""
    try:
        cal = Calendar.from_ical(ics_content)
        courses_by_week = {}

        for component in cal.walk():
            if component.name == "VEVENT":
                summary = str(component.get('summary', ''))
                dtstart = component.get('dtstart')

                if dtstart:
                    start_date = dtstart.dt
                    if hasattr(start_date, 'date'):
                        start_date = start_date.date()

                    week_num = start_date.isocalendar()[1]

                    if week_num not in courses_by_week:
                        courses_by_week[week_num] = []

                    # Corriger le décalage horaire (UTC+2)
                    time_obj = dtstart.dt
                    if hasattr(time_obj, 'hour'):
                        time_obj = time_obj + timedelta(hours=2)
                        time_str = time_obj.strftime('%H:%M')
                    else:
                        time_str = str(time_obj)

                    courses_by_week[week_num].append({
                        'date': start_date.strftime('%d %B').lower(),
                        'date_obj': start_date,
                        'time': time_str,
                        'matiere': summary.split(' - ')[0].strip() if ' - ' in summary else summary,
                    })

        # Trier par date
        for week in courses_by_week:
            courses_by_week[week].sort(key=lambda x: x['date_obj'])

        return courses_by_week
    except Exception as e:
        print(f"Erreur parsing ICS: {e}")
        return None


async def get_courses_from_ics():
    """Récupère les cours depuis le fichier ICS."""
    try:
        print("Téléchargement du fichier ICS...")
        response = requests.get(ICS_URL, timeout=10)
        response.raise_for_status()
        return parse_ics_file(response.text)
    except Exception as e:
        print(f"Erreur ICS: {e}")
        return None


async def get_courses_from_scraping():
    """Fallback: récupère les cours par scraping."""
    print("Scraping HyperPlanning (fallback)...")
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            await page.goto(HYPERPLANNING_URL)
            await page.wait_for_load_state("networkidle")

            await page.get_by_placeholder("Saisissez votre identifiant.").fill(USERNAME)
            await page.get_by_placeholder("Saisissez votre mot de passe.").fill(PASSWORD)
            await page.get_by_role("button", name="Se connecter").click()
            await page.wait_for_load_state("networkidle")

            await page.evaluate("""
                () => {
                    const items = document.querySelectorAll('[role="menuitem"].item-menu_niveau0');
                    const cours = Array.from(items).find(el =>
                        el.textContent.trim().startsWith('Cours')
                    );
                    if (cours) cours.click();
                }
            """)
            await page.wait_for_timeout(1500)

            await page.evaluate("""
                () => {
                    const items = document.querySelectorAll('[role="menuitem"]');
                    const planning = Array.from(items).find(el =>
                        el.getAttribute('aria-label') === 'en planning' ||
                        el.textContent.trim() === 'en planning'
                    );
                    if (planning) planning.click();
                }
            """)
            await page.wait_for_timeout(3000)

            content = await page.inner_text("body")
            await browser.close()

            courses_by_week = {}
            pattern = re.compile(
                r'Cours du (\d+ \w+) de (\d+ heures \d+) à (\d+ heures \d+)\n(.+?)\n',
                re.DOTALL
            )

            for match in pattern.finditer(content):
                date_str = match.group(1)
                time_str = match.group(2).split()[0] + "h" + match.group(2).split()[2]
                matiere = match.group(4).strip()

                week = 16
                courses_by_week.setdefault(week, []).append({
                    'date': date_str,
                    'time': time_str,
                    'matiere': matiere,
                })

            return courses_by_week
    except Exception as e:
        print(f"Erreur scraping: {e}")
        return None


def format_planning_whatsapp(courses_by_week: dict, week_current: int, week_next: int) -> str:
    """Formate 2 semaines pour WhatsApp."""
    jours_map = {
        "13 april": "LUNDI 13 AVRIL",
        "14 april": "MARDI 14 AVRIL",
        "15 april": "MERCREDI 15 AVRIL",
        "16 april": "JEUDI 16 AVRIL",
        "17 april": "VENDREDI 17 AVRIL",
        "20 april": "LUNDI 20 AVRIL",
        "21 april": "MARDI 21 AVRIL",
        "22 april": "MERCREDI 22 AVRIL",
        "23 april": "JEUDI 23 AVRIL",
        "24 april": "VENDREDI 24 AVRIL",
        "27 april": "LUNDI 27 AVRIL",
        "28 april": "MARDI 28 AVRIL",
        "29 april": "MERCREDI 29 AVRIL",
        "30 april": "JEUDI 30 AVRIL",
        "1 may": "VENDREDI 1 MAI",
        "2 may": "SAMEDI 2 MAI",
        "3 may": "DIMANCHE 3 MAI",
        "4 may": "LUNDI 4 MAI",
        "5 may": "MARDI 5 MAI",
    }

    message = "📅 *VOTRE PLANNING*\n\n"

    for week_num in [week_current, week_next]:
        cours_list = courses_by_week.get(week_num, [])
        if not cours_list:
            continue

        message += f"*SEMAINE {week_num}*\n\n"

        jour_courant = None
        for i, cours in enumerate(cours_list):
            date_normalized = cours['date'].lower()

            if date_normalized != jour_courant:
                jour_courant = date_normalized
                jour_complet = jours_map.get(date_normalized, date_normalized.upper())
                message += f"✨ {jour_complet}\n"
                message += "━━━━━━━━━━━━━━\n"

            message += f"- {cours['time']} : *{cours['matiere']}*\n"

            if i < len(cours_list) - 1 and cours_list[i + 1]['date'].lower() != jour_courant:
                message += "ㅤ\n"

        message += "\n"

    return message


def send_whatsapp(message: str) -> bool:
    """Envoie le message via Twilio WhatsApp."""
    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            from_=f"whatsapp:{TWILIO_WHATSAPP_FROM}",
            body=message,
            to=f"whatsapp:{WHATSAPP_TO}",
        )
        print(f"✅ Message envoyé ! SID: {msg.sid}")
        return True
    except Exception as e:
        print(f"❌ Erreur Twilio: {e}")
        return False


def save_planning_json(courses_by_week: dict, week_current: int, week_next: int) -> bool:
    """Sauvegarde le planning en fichier JSON pour le widget iPhone."""
    try:
        planning_data = {
            "timestamp": datetime.now().isoformat(),
            "weeks": {}
        }

        for week_num in [week_current, week_next]:
            cours_list = courses_by_week.get(week_num, [])
            if not cours_list:
                continue

            planning_data["weeks"][str(week_num)] = {
                "semaine": week_num,
                "courses": [
                    {
                        "date": course["date"],
                        "time": course["time"],
                        "matiere": course["matiere"]
                    }
                    for course in cours_list
                ]
            }

        # Sauvegarder dans /docs pour GitHub Pages
        os.makedirs("docs", exist_ok=True)
        with open("docs/planning.json", "w", encoding="utf-8") as f:
            json.dump(planning_data, f, ensure_ascii=False, indent=2)

        print("✅ Planning sauvegardé en JSON")
        return True
    except Exception as e:
        print(f"⚠️ Erreur sauvegarde JSON: {e}")
        return False


async def main():
    print("=" * 60)
    print(f"Execution à {datetime.now().strftime('%H:%M:%S')}")
    print("=" * 60)

    week_current, week_next = get_current_and_next_week()
    print(f"\nSemaine en cours: {week_current}, Semaine suivante: {week_next}")

    print("\n1️⃣ Tentative ICS...")
    courses_by_week = await get_courses_from_ics()

    if not courses_by_week:
        print("2️⃣ Fallback scraping...")
        courses_by_week = await get_courses_from_scraping()

    if not courses_by_week:
        print("❌ Impossible de récupérer les cours")
        return

    print("✏️ Formatage du message...")
    message = format_planning_whatsapp(courses_by_week, week_current, week_next)

    print("\n📤 Message à envoyer:\n")
    print(message)
    print("=" * 60)

    # Sauvegarder en JSON pour le widget iPhone
    save_planning_json(courses_by_week, week_current, week_next)

    # Committer et pousser le fichier JSON vers GitHub
    try:
        github_token = os.getenv('GITHUB_TOKEN', '')
        subprocess.run(['git', 'config', 'user.email', 'automation@github.com'], check=True)
        subprocess.run(['git', 'config', 'user.name', 'GitHub Action'], check=True)
        subprocess.run(['git', 'add', 'docs/planning.json'], check=True)
        subprocess.run(['git', 'commit', '-m', 'Update planning.json'], check=True)
        if github_token:
            repo_url = subprocess.run(['git', 'config', '--get', 'remote.origin.url'],
                                     capture_output=True, text=True, check=True).stdout.strip()
            auth_url = repo_url.replace('https://', f'https://x-access-token:{github_token}@')
            subprocess.run(['git', 'remote', 'set-url', 'origin', auth_url], check=True)
        subprocess.run(['git', 'push'], check=True)
        print("✅ planning.json poussé vers GitHub")
    except Exception as e:
        print(f"⚠️ Erreur git: {e}")

    # Envoyer via WhatsApp
    send_whatsapp(message)


if __name__ == "__main__":
    asyncio.run(main())
