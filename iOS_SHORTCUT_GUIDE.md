# 📱 iOS Shortcut - Guide complet (pas à pas)

## 🎯 Objectif final
Un widget iPhone qui affiche ton planning automatiquement toutes les heures.

---

## ⚙️ Étape 1 : Ouvrir l'app Raccourcis

1. Sur ton **iPhone**, ouvrir l'app **"Raccourcis"** (Shortcuts)
2. Aller en bas à droite → **"Automation"** (Automatisation)
3. Cliquer sur le **"+"** en haut à droite
4. Sélectionner **"Create Personal Automation"**

---

## 🔧 Étape 2 : Configurer l'automatisation horaire

**Au moment sélectionnez :**
1. Cliquer sur **"Time of Day"**
2. Cliquer sur l'heure → Entrer **07:00** (7:00 AM)
3. Cliquer sur **"Repeat"** → Sélectionner **"Hourly"**
4. Cliquer sur **"Next"**

---

## 📝 Étape 3 : Créer le script Shortcut

Vous allez ajouter ces actions **dans cet ordre exact** :

### Action 1️⃣ : Récupérer l'URL
- Ajouter : **"Get contents of URL"**
- URL : `https://wiscod.github.io/Planning-semaine/planning.json`

### Action 2️⃣ : Parser le JSON
- Ajouter : **"Get Dictionary Value"**
- Dictionnaire : Résultat de l'action précédente
- Clé : `timestamp`

### Action 3️⃣ : Extraire les semaines
- Ajouter : **"Get Dictionary Value"** (encore)
- Clé : `weeks`

### Action 4️⃣ : Afficher notification
- Ajouter : **"Show Result"** ou **"Show Notification"**
- Titre : 📅 Votre Planning
- Corps : Insérer le résultat précédent

### Action 5️⃣ (Optionnel) : Son
- Ajouter : **"Play Sound"**
- Son : Choisir un son notification

---

## 🎨 Étape 4 : Ajouter le widget à l'écran verrouillé

### Sur iPhone (iOS 16+)
1. **Verrouiller l'écran** (appui long sur le fond)
2. Cliquer sur **"Ajouter un widget"** (+)
3. Chercher **"Raccourcis"** (Shortcuts)
4. Sélectionner le raccourci que tu viens de créer
5. Ajouter le widget

### Sur écran d'accueil (tous les iPhone)
1. Appui long sur une zone vide
2. Cliquer sur **"+"**
3. Chercher **"Raccourcis"**
4. Ajouter le widget avec ton raccourci

---

## ✅ Étape 5 : Tester

1. **Ouvrir l'app Raccourcis**
2. Aller dans **"My Shortcuts"**
3. Trouver le raccourci créé
4. Cliquer dessus pour tester manuellement
5. **Vous devriez voir une notification** avec le planning en JSON

Si tu vois une notification → ✅ **Tout fonctionne !**

---

## 🔄 Options avancées

### Modifier l'apparence du widget
- Après ajout du widget, **appui long** dessus
- Cliquer **"Edit Widget"**
- Personnaliser la couleur, la taille, etc.

### Changer la fréquence de mise à jour
**Actuellement : Toutes les heures**

Pour changer (dans l'automatisation) :
1. Aller dans **Automation**
2. Trouver ton raccourci
3. Cliquer sur **"Edit"**
4. Modifier **"Hourly"** en :
   - 30 minutes
   - 15 minutes
   - Quotidien à une heure spécifique
5. Cliquer **"Done"**

---

## 🐛 Dépannage

### Le widget affiche "Pas d'action"
- **Solution** : Éditer le raccourci → Ajouter une action "Show Result"

### Le widget ne se met pas à jour
- Aller dans **Réglages → Raccourcis**
- Activer **"Autoriser les raccourcis non fiables"**

### L'URL ne fonctionne pas
- Vérifier que GitHub Pages est activé
- Tester l'URL dans Safari : https://wiscod.github.io/Planning-semaine/planning.json
- Devrait afficher du JSON brut

### Le JSON est vide
- Le script Python s'exécute à **5:00 AM** et **21:00 PM UTC**
- Attendre la prochaine exécution

---

## 📚 Format du JSON reçu

```json
{
  "timestamp": "2026-04-19T07:43:35",
  "weeks": {
    "16": {
      "semaine": 16,
      "courses": [
        {
          "date": "13 april",
          "time": "18:00",
          "matiere": "Hiring strategy"
        }
      ]
    }
  }
}
```

Tu peux traiter ce JSON comme tu veux dans le Shortcut !

---

## 🎓 Ressources Apple
- [Shortcuts User Guide](https://support.apple.com/en-us/HT208309)
- [Create a personal automation](https://support.apple.com/guide/shortcuts/create-a-personal-automation/ios)
- [Use Shortcuts on your home screen](https://support.apple.com/guide/shortcuts/use-a-shortcut-on-your-home-screen-ios-b9336d60/ios)

---

## 💡 Bonus : Affichage formaté

Si tu veux un affichage plus beau du planning, tu peux utiliser ces actions :

```
1. Get Dictionary Value → "weeks"
2. Text → Formater le JSON en texte lisible
3. Show Notification → Afficher le texte formaté
```

**Exemple de formatage :**
```
📅 VOTRE PLANNING

SEMAINE 16
✨ 13 AVRIL
- 18:00 : Hiring strategy

✨ 15 AVRIL  
- 09:30 : Soft-Defined DC Admin
```

Demande-moi si tu veux que je te crée ce formatage ! 🎨
