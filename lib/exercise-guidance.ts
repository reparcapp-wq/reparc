export type ExerciseGuidance = { setup: string; cues: string[]; stop: string };

const STOP = "Stop for sharp, sudden or worsening pain, dizziness, loss of control, or a range you cannot manage safely.";

export function exerciseGuidance(name: string): ExerciseGuidance {
  const value = name.toLowerCase();
  if (/squat|leg press|leg extension|lunge|step-up/.test(value)) return { setup: "Brace before the rep, keep the whole foot supported, and choose a pain-free depth you can control.", cues: ["Track knees in the direction of the toes.", "Lower under control; drive through the supported foot.", "Keep the load balanced rather than chasing depth."], stop: STOP };
  if (/deadlift|rdl|good morning|hip thrust|glute bridge|kickback/.test(value)) return { setup: "Set the ribs over the pelvis, brace, and begin with the load close to the body or hips.", cues: ["Move through the hips without forcing the lower back.", "Keep pressure even through the feet.", "Finish tall; do not overextend at lockout."], stop: STOP };
  if (/press|bench|push-up|dip|fly|pec deck/.test(value)) return { setup: "Create a stable base, set the shoulder blades comfortably, and use a grip that keeps wrists stacked.", cues: ["Lower with control to a comfortable range.", "Keep forearms aligned with the direction of force.", "Do not bounce or lose shoulder position."], stop: STOP };
  if (/row|pulldown|pull-up|face pull|rear-delt|reverse pec/.test(value)) return { setup: "Set a stable torso and begin with the shoulder in a comfortable, controlled position.", cues: ["Lead with the elbow instead of jerking the hand.", "Keep the neck relaxed and ribs controlled.", "Pause briefly, then return through a controlled range."], stop: STOP };
  if (/leg curl|nordic/.test(value)) return { setup: "Align the machine or support with the knee and keep the hips stable through a comfortable range.", cues: ["Curl without lifting or twisting the hips.", "Pause briefly at peak tension.", "Return slowly without letting the stack slam."], stop: STOP };
  if (/curl|triceps|pushdown|extension|skull/.test(value)) return { setup: "Use a stable stance and choose a joint-friendly grip with the elbow supported or still.", cues: ["Move through the elbow without swinging the torso.", "Control the stretched position.", "End the set before technique becomes forced."], stop: STOP };
  if (/lateral raise|calf raise/.test(value)) return { setup: "Choose a load that allows a smooth, controlled range without momentum.", cues: ["Keep the working joint aligned.", "Pause in the shortened position.", "Lower more slowly than you lift."], stop: STOP };
  if (/curl|crunch|leg raise|plank|ab|core/.test(value)) return { setup: "Brace gently, keep breathing, and use only the range you can control without pulling on the neck.", cues: ["Move from the trunk or hips as intended.", "Avoid momentum.", "Stop before the lower back loses control."], stop: STOP };
  return { setup: "Use a stable setup, a manageable load, and a pain-free range of motion.", cues: ["Keep each repetition controlled.", "Maintain normal breathing and joint alignment.", "End the set when technique changes meaningfully."], stop: STOP };
}
