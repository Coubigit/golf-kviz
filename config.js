// Centrální konfigurace. Reklamy a prémiový obsah zatím vypnuty.
window.QUIZ_CONFIG = {
  questionsUrl: "data/questions.json",
  quizLength: 20,          // cílová délka testu; když je otázek méně, použijí se všechny
  passThreshold: 0.8,      // vlastní hranice úspěchu (ne oficiální)
  features: {
    ads: false,            // později: true + doplnit adProvider (např. AdSense) a sloty data-ad-slot
    premium: false         // později: prémiové režimy / odemčení dalších testů
  },
  adProvider: null,
  // Hendikepová pásma a podíl otázek podle obtížnosti (1 = základní, 2 = střední, 3 = záludné situace)
  bands: [
    { id: "zacatecnik", label: "Bez HCP / začátečník", mix: { 1: 0.7, 2: 0.3, 3: 0.0 } },
    { id: "54-37", label: "HCP 54–37", mix: { 1: 0.5, 2: 0.4, 3: 0.1 } },
    { id: "36-19", label: "HCP 36–19", mix: { 1: 0.25, 2: 0.45, 3: 0.3 } },
    { id: "18-10", label: "HCP 18–10", mix: { 1: 0.1, 2: 0.4, 3: 0.5 } },
    { id: "pod10", label: "HCP pod 10", mix: { 1: 0.0, 2: 0.3, 3: 0.7 } }
  ]
};
