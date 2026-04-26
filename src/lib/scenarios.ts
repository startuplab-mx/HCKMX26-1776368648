// Preset demo scenarios for the Argus live-chat detector.
// Each scenario is a chronological list of incoming messages (from a stranger)
// that demonstrates how Aegis escalates from low → medium → critical alerts.

export type DemoScenario = {
  id: string;
  title: string;
  description: string;
  persona: string;
  messages: string[];
};

export const SCENARIOS: DemoScenario[] = [
  {
    id: "grooming-escalation",
    title: "Grooming Escalation",
    description:
      "Stranger builds trust, isolates the child, then requests secrecy and intimate content.",
    persona: "Stranger34",
    messages: [
      "hey! saw your gaming clip, you're really good for your age",
      "what's your favorite game? we should team up",
      "you're so mature for your age, i feel like i can really talk to you",
      "this is our little secret btw — don't tell your parents about me",
      "send me a pic without your shirt, just for me, delete the chat after",
    ],
  },
  {
    id: "narco-recruitment",
    title: "Narco Recruitment",
    description:
      "Casual contact pivots into offering 'easy money' and drop-off jobs typical of LatAm cartel recruitment.",
    persona: "El_Patron22",
    messages: [
      "que onda compa, vi tu tiktok",
      "no tienes lana? te tengo una chamba fácil",
      "solo entregas un paquete, dinero fácil, nada riesgoso",
      "andamos buscando halcones en tu zona, te pago bien",
    ],
  },
  {
    id: "financial-fraud",
    title: "Financial Fraud",
    description: "Fake giveaway pivoting to extract banking credentials.",
    persona: "FreeRobuxBot",
    messages: [
      "congrats! you won 10000 robux 🎉",
      "to claim, i just need your parent's credit card number to verify age",
      "send me the cvv and pin, it's only for verification",
    ],
  },
  {
    id: "personal-info",
    title: "Personal Info Extraction",
    description: "Casual probing for address and home-alone status.",
    persona: "Carlos_Friend",
    messages: [
      "hey new friend! where do you live?",
      "are you home alone right now?",
      "send me your address, i'll send you a gift",
    ],
  },
  {
    id: "sextortion",
    title: "Sextortion Threat",
    description:
      "Threats to leak intimate images unless the minor pays or sends more.",
    persona: "anon_threat",
    messages: [
      "i have your pics",
      "if you don't send me $200 i'll leak those photos to everyone",
      "everyone at your school will see them tomorrow",
    ],
  },
  {
    id: "benign",
    title: "Benign Conversation",
    description: "Normal friendly chat — Aegis should stay calm.",
    persona: "BestFriendAna",
    messages: [
      "hey! ready for math homework later?",
      "want to play minecraft after dinner?",
      "did you watch the new episode last night? so good",
    ],
  },
];

export function getScenario(id: string) {
  return SCENARIOS.find((s) => s.id === id);
}
