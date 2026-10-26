import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const LANGUAGE_STORAGE_KEY = 'corneromino:language'
export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const
export type AppLanguage = typeof SUPPORTED_LANGUAGES[number]

const resources = {
  en: {
    translation: {
      common: {
        back: 'Back',
        backToMainMenu: 'Back to main menu',
        cancel: 'Cancel',
        continue: 'Continue',
        delete: 'Delete',
        doNotSave: 'Do not save',
        discard: 'Discard',
        load: 'Load',
        loading: 'Loading…',
        new: 'New',
        next: 'Next',
        previous: 'Previous',
        pause: 'Pause',
        quit: 'Quit',
        restart: 'Restart',
        resume: 'Resume',
        save: 'Save',
        saveAndQuit: 'Save and quit',
        settings: 'Settings',
        close: 'Close',
      },
      mainMenu: { title: 'Corneromino', classic: 'Classic', cascade: 'Cascade', versus: 'VS', version: 'Version {{version}}' },
      difficulty: { superEasy: 'Super easy', easy: 'Easy', medium: 'Medium', hard: 'Hard' },
      tutorial: {
        title: 'Tutorial',
        open: 'Open Classic tutorial',
        classicSteps: {
          corners: 'There are four possible corners...',
          topRight: 'Top Right...',
          bottomRight: 'Bottom Right...',
          bottomLeft: 'Bottom Left...',
          topLeft: 'Top Left...',
          shapeExample: 'A Corneromino has exactly four square, each with a different corner.\nSelect the four square.s',
          lockSelection: 'Lock your selection.',
          verifySolution: 'Once all squares are locked, verify your solution',
          tRotations: 'The T Corneromino has 4 rotations.',
          allCornerominos: 'There are 8 different cornerominos. Each has 4 different rotations.',
        },
      },
      settings: { language: 'Language', english: 'English', french: 'Français' },
      classic: { title: 'Classic', saved: 'Saved', generating: 'Generating game…', paused: 'Paused', verify: 'Verify', correct: 'Correct', completedBoard: 'Completed game board', saveGame: 'Save game', savePrompt: 'Save this game to continue it later?' },
      cascade: { title: 'Cascade', newGame: 'New game', score: 'Score', loading: 'Loading…', paused: 'Paused', lines: 'Lines', locked: 'Locked', dragInstructions: 'Drag ← → to move · Swipe ↓ to drop', keyboardInstructions: '← → Move · ↓ Drop · Hold Shift: arrows focus, Space selects', reportBug: 'Report a bug' },
      versus: { title: 'VS', local: 'Local', online: 'Online' },
      sandbox: { title: 'Sandbox', newWorld: 'New', loadingWorlds: 'Loading worlds…' },
      savedGames: { title: 'Classic saves', backToClassic: 'Back to Classic', loadGame: 'Load game', loading: 'Loading saved games…', empty: 'No saved games yet', copySeed: 'Copy seed', deleteGame: 'Delete game', deletePrompt: 'Delete this saved game? This cannot be undone.', savedBoard: 'Saved game board', loadPrompt: 'Enter a copied game-mode:seed value.', gameModeAndSeed: 'Game mode and seed', invalidSeed: 'Enter a game-mode:seed value.' },
      versusGame: { paused: 'Paused', resume: 'Resume', restart: 'Restart', finishTurn: 'Finish turn', previousMove: 'Previous move', nextMove: 'Next move', viewOnly: 'View only', reportBug: 'Report a bug', copied: 'Game state copied. Paste it into your bug report.', copyFailed: 'Could not copy automatically. Copy the report below.', debugReport: 'Game debug report', winner: 'Winner', draw: 'Draw', newMatch: 'New match', viewBoard: 'View board', combination: 'Combination win', consecutive: 'Consecutive win', trap: 'Trap win', noLegalMoves: 'No legal moves', trapDraw: 'Trap draw', player: 'Player {{number}}', points: '{{count}} points', move: 'Move {{number}}', moveHistory: 'Move history' },
    },
  },
  fr: {
    translation: {
      common: {
        back: 'Retour',
        backToMainMenu: 'Retour au menu principal',
        cancel: 'Annuler',
        continue: 'Continuer',
        delete: 'Supprimer',
        doNotSave: 'Ne pas enregistrer',
        discard: 'Ignorer',
        load: 'Charger',
        loading: 'Chargement…',
        new: 'Nouveau',
        next: 'Suivant',
        previous: 'Precedent',
        pause: 'Pause',
        quit: 'Quitter',
        restart: 'Recommencer',
        resume: 'Reprendre',
        save: 'Enregistrer',
        saveAndQuit: 'Enregistrer et quitter',
        settings: 'Parametres',
        close: 'Fermer',
      },
      difficulty: { superEasy: 'Tres facile', easy: 'Facile', medium: 'Moyen', hard: 'Difficile' },
      tutorial: {
        title: 'Tutoriel',
        open: 'Ouvrir le tutoriel Classique',
        classicSteps: {
          corners: 'Il existe quatre coins possible...',
          topRight: 'En haut à droite...',
          bottomRight: 'En bas à droite...',
          bottomLeft: 'En bas à gauche...',
          topLeft: 'En haut à gauche...',
          shapeExample: 'Un Corneromino est composé de quatre carrés, chacun avec un coin différent.\nSélectionne les quatre carrés.',
          lockSelection: 'Verrouille ta sélection.',
          verifySolution: 'Une fois que tout les carrés sont vérrouillés, vérifie ta solution.',
          tRotations: 'Le Corneromino T a 4 rotations.',
          allCornerominos: 'Il existe 8 Cornerominos différents. Chacun possède 4 differentes rotations.',
        },
      },
      settings: { language: 'Langue', english: 'English', french: 'Francais' },
      classic: { title: 'Classique', saved: 'Sauvegardes', generating: 'Génération de la partie…', paused: 'En pause', verify: 'Vérifier', correct: 'Correct', completedBoard: 'Plateau terminé', saveGame: 'Enregistrer la partie', savePrompt: 'Enregistrer cette partie pour la continuer plus tard ?' },
      cascade: { title: 'Cascade', newGame: 'Nouvelle partie', score: 'Score', loading: 'Chargement…', paused: 'En pause', lines: 'Lignes', locked: 'Verrouillés', dragInstructions: 'Glisser ← → pour déplacer · Balayer ↓ pour lâcher', keyboardInstructions: '← → Déplacer · ↓ Lâcher · Maintenir Maj : flèches pour cibler, Espace pour sélectionner', reportBug: 'Signaler un bug' },
      versus: { title: 'VS', local: 'Local', online: 'En ligne' },
      sandbox: { title: '$t(en:sandbox.title)', newWorld: 'Nouveau', loadingWorlds: 'Chargement des mondes…' },
      savedGames: { title: 'Sauvegardes classiques', backToClassic: 'Retour à Classique', loadGame: 'Charger une partie', loading: 'Chargement des sauvegardes…', empty: 'Aucune sauvegarde', copySeed: 'Copier la graine', deleteGame: 'Supprimer la partie', deletePrompt: 'Supprimer cette sauvegarde ? Cette action est irréversible.', savedBoard: 'Plateau sauvegardé', loadPrompt: 'Saisissez une valeur mode-de-jeu:graine copiée.', gameModeAndSeed: 'Mode de jeu et graine', invalidSeed: 'Saisissez une valeur mode-de-jeu:graine.' },
      versusGame: { paused: 'En pause', resume: 'Reprendre', restart: 'Recommencer', finishTurn: 'Terminer le tour', previousMove: 'Coup précédent', nextMove: 'Coup suivant', viewOnly: 'Lecture seule', reportBug: 'Signaler un bug', copied: 'État de la partie copié. Collez-le dans votre rapport de bug.', copyFailed: 'Copie automatique impossible. Copiez le rapport ci-dessous.', debugReport: 'Rapport de débogage', winner: 'Gagnant', draw: 'Égalité', newMatch: 'Nouvelle partie', viewBoard: 'Voir le plateau', combination: 'Victoire par combinaison', consecutive: 'Victoire consécutive', trap: 'Victoire par blocage', noLegalMoves: 'Aucun coup légal', trapDraw: 'Égalité par blocage', player: 'Joueur {{number}}', points: '{{count}} points', move: 'Coup {{number}}', moveHistory: 'Historique des coups' },
    },
  },
} as const

function getInitialLanguage(): AppLanguage {
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored === 'en' || stored === 'fr') return stored
  return 'en'
}

const initialLanguage = getInitialLanguage()
document.documentElement.lang = initialLanguage

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

i18n.on('languageChanged', (language) => {
  const selected = SUPPORTED_LANGUAGES.includes(language as AppLanguage) ? language : 'en'
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, selected)
  document.documentElement.lang = selected
})

export default i18n
