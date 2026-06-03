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
USERNAME = os.getenv("HYPERPLANNING_USERNAME", "DJIHOUA")
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
        import traceback
        error_msg = f"Erreur ICS: {e}\n{traceback.format_exc()}"
        print(error_msg)
        os.makedirs("docs", exist_ok=True)
        with open("docs/error_ics.txt", "w") as f:
            f.write(error_msg)
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
            
            # Bulletproof login: close cookie via JS, hide backdrop, press enter, and force click login
            await page.evaluate("""
                () => {
                    const elements = Array.from(document.querySelectorAll('*'));
                    const fermerBtn = elements.find(el => el.textContent && el.textContent.trim() === 'Fermer');
                    if (fermerBtn) fermerBtn.click();
                    
                    const backdrop = document.querySelector('.BloquerInterface');
                    if (backdrop) backdrop.style.display = 'none';
                }
            """)
            await page.wait_for_timeout(1000)
            
            await page.keyboard.press("Enter")
            
            await page.evaluate("""
                () => {
                    const loginBtn = Array.from(document.querySelectorAll('button, div, a')).find(el => el.textContent && el.textContent.trim() === 'Se connecter');
                    if (loginBtn) loginBtn.click();
                }
            """)
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

            courses_by_week = {}
            mois_fr = {
                'janvier': 1, 'février': 2, 'fevrier': 2, 'mars': 3, 'avril': 4,
                'mai': 5, 'juin': 6, 'juillet': 7, 'août': 8, 'aout': 8,
                'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12, 'decembre': 12
            }

            for i in range(3):
                # Extraire les aria-labels et le texte visible
                courses_data = await page.evaluate("""
                    () => {
                        return Array.from(document.querySelectorAll('[aria-label]'))
                                    .filter(el => el.getAttribute('aria-label').toLowerCase().includes('cours du'))
                                    .map(el => {
                                        return {
                                            aria: el.getAttribute('aria-label'),
                                            text: el.innerText || ''
                                        };
                                    });
                    }
                """)
                
                for item in courses_data:
                    label = item['aria']
                    text = item['text']
                    
                    try:
                        first_line = label.replace('\\r', '').replace('\\n', ' ')
                        match = re.search(r'du(?: [a-zA-Zûéè]+)? (\d+ [a-zA-Zûéè]+) de (.*?) à (.*?)$', first_line, re.IGNORECASE)
                        if match:
                            date_raw = match.group(1).lower()
                            time_start = match.group(2).replace(' heures ', 'h').replace(' ', '')
                            
                            parts = date_raw.split()
                            day = int(parts[0])
                            month = mois_fr.get(parts[1], datetime.now().month)
                            year = datetime.now().year
                            if datetime.now().month >= 9 and month < 8:
                                year += 1
                                
                            date_obj = datetime(year, month, day)
                            week = date_obj.isocalendar()[1]
                            
                            mois_en = {
                                1: 'january', 2: 'february', 3: 'march', 4: 'april',
                                5: 'may', 6: 'june', 7: 'july', 8: 'august',
                                9: 'september', 10: 'october', 11: 'november', 12: 'december'
                            }
                            date_str = f"{day} {mois_en.get(month, 'january')}"
                            
                            # Extraire la matiere propre
                            clean_text = text.replace('\r', '').replace('\n\n', '\n')
                            lines = [line.strip() for line in clean_text.split('\n') if line.strip()]
                            matiere = "Cours"
                            for line in lines:
                                if "Ouverture" in line or "détails" in line or "dǸtails" in line:
                                    continue
                                if "h" in line and any(c.isdigit() for c in line):
                                    continue
                                if len(line) > 2:
                                    matiere = line
                                    break
                            
                            week_courses = courses_by_week.setdefault(week, [])
                            course_id = f"{date_str}_{time_start}_{matiere}"
                            if not any(f"{c['date']}_{c['time']}_{c['matiere']}" == course_id for c in week_courses):
                                week_courses.append({
                                    'date': date_str,
                                    'time': time_start,
                                    'matiere': matiere,
                                })
                    except Exception as e:
                        print(f"Erreur parsing label: {label} -> {e}")

                # Prendre un screenshot pour debogage
                await page.screenshot(path=f"docs/debug_week{i}.png", full_page=True)

                # Navigate to next week using the week ruler!
                week_current = datetime.now().isocalendar()[1]
                next_week_num = week_current + i + 1
                try:
                    await page.evaluate(f"""
                        () => {{
                            const els = Array.from(document.querySelectorAll('.calendrier-jour'));
                            const weekBtn = els.find(el => el.textContent.trim() === '{next_week_num}');
                            if (weekBtn) weekBtn.click();
                        }}
                    """)
                except Exception as e:
                    print(f"Erreur click semaine: {e}")
                
                await page.wait_for_timeout(2500)

            await browser.close()
            return courses_by_week
    except Exception as e:
        import traceback
        error_msg = f"Erreur scraping: {e}\n{traceback.format_exc()}"
        print(error_msg)
        os.makedirs("docs", exist_ok=True)
        with open("docs/error_scraping.txt", "w") as f:
            f.write(error_msg)
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

    has_relevant_courses = False
    if courses_by_week:
        if courses_by_week.get(week_current) or courses_by_week.get(week_next):
            has_relevant_courses = True

    if not has_relevant_courses:
        print("2️⃣ Fallback scraping...")
        scraping_result = await get_courses_from_scraping()
        if scraping_result is not None:
            courses_by_week = scraping_result

    if courses_by_week is None:
        print("❌ Impossible de récupérer les cours")
        try:
            subprocess.run(['git', 'config', 'user.email', 'automation@github.com'], check=True)
            subprocess.run(['git', 'config', 'user.name', 'GitHub Action'], check=True)
            subprocess.run(['git', 'add', 'docs/'], check=True)
            subprocess.run(['git', 'commit', '-m', 'Update errors'], check=True)
            subprocess.run(['git', 'push'], check=True)
        except Exception as e:
            print(f"Erreur git (errors): {e}")
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
        subprocess.run(['git', 'config', 'user.email', 'automation@github.com'], check=True)
        subprocess.run(['git', 'config', 'user.name', 'GitHub Action'], check=True)
        subprocess.run(['git', 'add', 'docs/'], check=True)
        subprocess.run(['git', 'commit', '-m', 'Update planning and debug screenshots'], check=True)
        subprocess.run(['git', 'push'], check=True)
        print("✅ planning.json poussé vers GitHub")
    except Exception as e:
        print(f"⚠️ Erreur git: {e}")

    # Envoyer via WhatsApp
    send_whatsapp(message)


if __name__ == "__main__":
    asyncio.run(main())
