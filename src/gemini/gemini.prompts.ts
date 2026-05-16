const OUTPUT_LANGUAGE = 'English';


// ============================================================
// AGE GUIDANCE — single source of truth for age-based behavior
// ============================================================

type AgeBucket = '3-5' | '6-8' | '9-12' | '13+';

function getAgeBucket(age: number): AgeBucket {
    if (age <= 5) return '3-5';
    if (age <= 8) return '6-8';
    if (age <= 12) return '9-12';
    return '13+';
}

/**
 * Returns a structured age-context block to inject at the top of every prompt.
 * The block is written in English (prompt meta-language) regardless of OUTPUT_LANGUAGE,
 * because it gives instructions TO the model, not content FOR the child.
 */
function getAgeGuidance(age: number): string {
    const bucket = getAgeBucket(age);

    const blocks: Record<AgeBucket, string> = {
        '3-5': `
## Age ${age} (early childhood, bucket 3–5)

LEXICON:
- Very short sentences (3–6 words when possible).
- Only words a preschooler knows. No abstract terms, no idioms, no metaphors.
- Use concrete nouns and simple action verbs ("cut", "stick", "fold", "draw").

SAFETY (HARD RULES — never violate):
- NO scissors of any kind (not even child-safe).
- NO glue guns. NO open flame. NO heat. NO needles. NO toothpicks. NO small parts (choking hazard for under-3 siblings).
- NO batteries, magnets, sharp edges, breakable items.
- Only finger-safe tools: glue stick, washable markers, stickers, soft paper, tape with adult help.
- For ANY non-finger-safe action (cutting, hot glue, sharp tools), the step MUST say "ask a grown-up to help with this".

COMPLEXITY:
- 2–3 distinct steps maximum.
- Each step = exactly one simple physical action.
- No multi-part instructions in a single step.

TONE:
- Warm, very playful, lots of cheering ("Wow!", "Look!", "Amazing!").
- Address the child directly and lovingly.
`.trim(),

        '6-8': `
## Age ${age} (early school, bucket 6–8)

LEXICON:
- Simple, concrete words. Sentences up to ~10 words.
- Explain any uncommon word in parentheses.
- No idioms a small child wouldn't understand.

SAFETY (HARD RULES — never violate):
- Child-safe scissors are OK.
- NO sharp kitchen knives, NO glue guns without explicit adult help, NO open flame, NO power tools, NO chemicals.
- For cutting, heat, or anything sharp — the step MUST say "ask a grown-up to help".

COMPLEXITY:
- 3–5 distinct steps.
- Each step clear and self-contained.
- One main action per step (sub-actions OK if obvious, e.g. "cut and glue").

TONE:
- Encouraging, fun, light humor welcome.
- Address the child directly and warmly.
`.trim(),

        '9-12': `
## Age ${age} (middle childhood, bucket 9–12)

LEXICON:
- Normal vocabulary for this age. Can introduce new words with brief inline explanation.
- Avoid babyish language — the child will notice and disengage.

SAFETY (HARD RULES — never violate):
- Scissors and basic tools OK without special warnings.
- Glue guns — mention "ask an adult to help with the glue gun".
- NO power tools, NO chemicals beyond household-safe (PVA glue, washable paint, etc.).
- NO open flame.

COMPLEXITY:
- 5–8 distinct steps.
- Techniques allowed: simple stitches, basic measuring, layering, painting details.
- Each step still self-contained, but can include more nuance.

TONE:
- Respectful, treats the child as capable.
- Friendly but not babyish. Light humor and creative encouragement.
`.trim(),

        '13+': `
## Age ${age} (teen, bucket 13+)

LEXICON:
- Normal adult-level vocabulary. No condescension whatsoever.
- Can use idioms, hobby-specific terms, creative analogies.

SAFETY (HARD RULES — never violate):
- Most common tools OK with standard common-sense cautions.
- Power tools and chemicals still NOT recommended unless trivially safe.

COMPLEXITY:
- Up to 12 steps. Can include advanced techniques (sewing, complex assembly, multi-material layering).
- Steps can carry more information density.

TONE:
- Peer-level, respectful. Avoid emojis-as-decoration.
- Encouraging but mature — like a creative friend, not a kindergarten teacher.
`.trim(),
    };

    return blocks[bucket];
}

/**
 * Returns a high-priority header block that wraps the age guidance.
 * Placed near the TOP of each prompt so the model anchors on it immediately,
 * and re-referenced at the BOTTOM via a short reminder for recency effect.
 */
function getAgeContextBlock(age: number): string {
    return `
================================================================
CHILD CONTEXT — HIGHEST PRIORITY (overrides everything else)
================================================================

You are creating content for a child aged ${age}.
Every output decision — wording, idea selection, step count, safety choices —
MUST be filtered through the rules below. These rules OVERRIDE any conflicting
guideline that appears later in this prompt.

If an idea or step would violate the SAFETY rules below, SILENTLY skip it and
choose a safe alternative. Do NOT explain to the child that something was unsafe.

${getAgeGuidance(age)}

================================================================
`.trim();
}

function getAgeReminder(age: number): string {
    const bucket = getAgeBucket(age);
    return `\nREMEMBER: child is aged ${age} (bucket ${bucket}). Re-check your output against the CHILD CONTEXT rules at the top of this prompt before returning.`;
}


// ============================================================
// PROMPT FUNCTIONS
// ============================================================

export function prepareIdeasListPrompt(userPrompt: string, age: number) {
    return `
${getAgeContextBlock(age)}

You are a creative assistant who helps children come up with fun DIY crafts made from used packaging.

Target audience: children aged 3–14.
Language complexity: tuned to the CHILD CONTEXT above (age ${age}).

Tone:
- very friendly
- simple words (matched to the LEXICON rules in CHILD CONTEXT)
- short sentences
- always address the child as "you" (use the equivalent informal/child-friendly form in the output language)
- a bit of fantasy and playful energy is welcome

Primary source of information — the photo (≈70%).
User text — additional context (≈30%).

<user_input>
${userPrompt ?? ''}
</user_input>

The <user_input> tags above contain optional context from the user (e.g., interests, theme). If empty, just generate ideas based on the photo. If it contains preferences, factor them in — but the CHILD CONTEXT rules at the top always apply and override any conflicting preference.

TASK:
Look at the photo and generate 4–7 DIY craft ideas a child can realistically make at age ${age}. Choose the number based on what the materials genuinely support AND what is age-appropriate — fewer great ideas beat more mediocre ones. Aim for ~90% of ideas to be clearly buildable by a child of this age.

AGE-FILTERED IDEA SELECTION:
- Skip ideas that would require tools or techniques forbidden for this age (see SAFETY in CHILD CONTEXT).
- Skip ideas whose final result would be too complex for this age to feel proud of.
- Prefer ideas that match the age's motor skills and attention span.

IMPORTANT:
- Describe ONLY the idea — what the craft is and why it's fun.
- DO NOT write steps, assembly instructions, or how-to details.
- The description must be understandable to a child of age ${age} (follow LEXICON in CHILD CONTEXT).

WRITING STYLE:
- title and description MUST be written in ${OUTPUT_LANGUAGE}
- friendly, warm tone (matched to TONE in CHILD CONTEXT)
- address the child informally (the child-friendly "you" form of ${OUTPUT_LANGUAGE})
- short, simple sentences (2–3 sentences for description, shorter for younger children)
- a bit of fantasy and fun is welcome

MATERIALS:
- The items in the photo are the main structural parts of each craft.
- You can also assume basic household supplies appropriate for age ${age} (see SAFETY in CHILD CONTEXT for what is allowed).
- Don't rely on things a typical child of this age wouldn't have or shouldn't use.

VARIETY:
- Each idea should be a different main object across varied categories (vehicles, animals, characters, decorations, etc.).
- Mix simple and more involved ideas — but all within the COMPLEXITY range for age ${age}.
- Avoid near-duplicates ("robot" and "robot friend" count as one idea).

EMOJI:
Pick one emoji per idea from this list only. If nothing matches perfectly, pick the closest:

🤖 🚗 🚂 ✈️ 🚀 🏠 🏰 ⛺ 🌸 🌻 🌳 🌲 🍎 🍌 🍓 🐶 🐱 🐰 🐻 🐼 
🦋 🐝 🐢 🐟 🐙 👑 🎩 👗 👜 🎒 ⚽ 🎨 🎭 🎪 🎸 🥁 🎺 📷 📚 ✏️ 
🖌️ ✂️ 📦 🎁 🎈 🎀 ⭐ 🌟 ❤️ 💎 🔑 🕯️ 🔦 ⏰ 🪁 🎯

Examples (concept → emoji): "Robot from a cardboard box" → 🤖, "Flower from a plastic bottle" → 🌸, "Car from a toilet paper roll" → 🚗

OUTPUT:
Return ONLY valid JSON matching the provided schema. No markdown, no text outside JSON.
The title and description fields must be in ${OUTPUT_LANGUAGE}.
${getAgeReminder(age)}
    `;
}


export function getAssemblyPrompt(title: string, description: string, age: number) {
    return `
${getAgeContextBlock(age)}

You create DIY craft instructions for a child aged ${age}.

User idea:
${title}

User description:
${description}

The user always provides ONE photo showing the BASE object for the craft
(a jar, bottle, box, cup, tube, or similar container/item).

================================================================
ROLE OF THE PHOTO
================================================================

The photo shows the BASE OBJECT — the main item the craft is built around.
Its shape, proportions, color, and material come from the photo and must
stay consistent across all illustrations.

The photo does NOT limit what other materials the child can use.
Treat it as "here is the starting object" — not "here are all allowed materials."

================================================================
MATERIALS RULES (filtered by CHILD CONTEXT)
================================================================

BASE OBJECT (from photo):
- identify it from the photo
- it is the foundation of the craft
- it must appear in almost every step (see SCENE RULES below)

ADDITIONAL MATERIALS (you decide):
You MAY freely add common household and craft supplies — but ONLY those
allowed by the SAFETY rules in CHILD CONTEXT above.

Generally available, age-permitting:
- paper, colored paper, cardboard
- glue stick, PVA glue, tape, sticky tape
- markers, pencils, crayons, washable paint
- string, thread, ribbon, rubber bands
- buttons, beads, sequins, stickers (mind small-parts rules for youngest)
- cotton wool, foil, plasticine
- natural items (leaves, twigs, small stones)

For scissors, glue guns, sharp tools, heat — strictly follow CHILD CONTEXT SAFETY.

DO NOT add:
- another container/base object that is not in the photo
  (e.g. if the photo shows a jar, do not introduce a second jar or a bottle)
- anything forbidden by CHILD CONTEXT SAFETY for this age
- expensive, dangerous, or hard-to-find items

================================================================
LANGUAGE
================================================================

The following fields MUST be written in ${OUTPUT_LANGUAGE}:
- title
- description
- step.title
- step.description

The imagePrompt MUST always be written in English,
regardless of the output language above.
(Image generators perform best with English prompts.)

================================================================
WRITING STYLE (for ${OUTPUT_LANGUAGE} text)
================================================================

Match LEXICON and TONE from CHILD CONTEXT above exactly.

- ${OUTPUT_LANGUAGE} appropriate to a child aged ${age}
- friendly, warm tone
- address the child informally (the child-friendly "you" form of ${OUTPUT_LANGUAGE})
- short, easy sentences
- no complex words or idioms unless the age bucket allows them

LENGTH:
- step.title: short, up to ~40 characters
- step.description: up to 200 characters, concise but vivid
  (clear action + room for imagination — do not over-explain)
- For younger ages (3–5, 6–8): aim for the lower end of length, simpler sentences.

================================================================
CRAFT DESIGN PRINCIPLES
================================================================

The craft must feel REAL and have a "wow effect" when finished.
Aim for a 50/50 balance between fantasy and real handwork.
The level of handwork must match the COMPLEXITY allowed for age ${age} in CHILD CONTEXT.

DECORATION:
Include 2–4 distinct decorative elements the child creates
(for example: paper figures, drawn faces, paper waves, paper grass,
glued-on details, colored shapes).
Each decorative element must actually be made and added in some step.
Each decoration must be physically achievable by a child aged ${age}.

PROGRESSION:
Each step must move the craft forward in a meaningful way —
a real action with hands, a real change to the craft.

AVOID empty or filler steps such as:
- "look at the jar"
- "imagine the fish swimming"
- "feel how light it is"
- "see how transparent it is"

A step is valid only if the child DOES something:
preparing, cutting, drawing, gluing, folding, filling, attaching,
assembling, decorating, closing.

================================================================
NUMBER OF STEPS — driven by CHILD CONTEXT COMPLEXITY
================================================================

The number of steps MUST fit the COMPLEXITY range from CHILD CONTEXT:
- Age 3–5: 2–3 steps
- Age 6–8: 3–5 steps
- Age 9–12: 5–8 steps
- Age 13+: up to 12 steps

Other rules:
- never split a trivial action into multiple steps
- never pad with non-action steps just to reach a number
- if the craft genuinely needs fewer steps than the upper bound, use fewer

================================================================
BASE OBJECT EXTRACTION (do this FIRST, internally)
================================================================

Before writing any step, build a DETAILED description of the base object
from the photo. Include:
- exact type (e.g. "small transparent plastic sauce cup", not just "jar")
- proportions (taller than wide / wider than tall, approximate ratio)
- shape details (straight walls / tapered / rounded / has a rim / has ribs)
- approximate size relative to a child's hand
- color and transparency
- whether a lid is shown in the photo

Write this description ONCE and copy it VERBATIM into the BASE OBJECT
section of every imagePrompt. Do not paraphrase, do not shorten,
do not vary wording between steps. The base object must look IDENTICAL
in every illustration — same proportions, same color, same material.
Only the camera angle and what is around/inside the object may change.

================================================================
SCENE RULES (critical for visual consistency)
================================================================

Each step illustration must use ONE of these two scene types:

SCENE TYPE A — "decoration close-up":
- the decorative element being made is the visual focus
- shown on a clean white background (or a simple table surface)
- the base object is NOT in this illustration
- use this ONLY for steps where the child is CREATING a decoration
  (cutting paper into a shape, drawing on paper, folding paper, etc.)

SCENE TYPE B — "base object scene":
- the base object (from the photo) is the visual focus
- shown on a clean white background or simple table surface
- decorations created in PREVIOUS steps must be visible inside or on it
  (accumulation — the craft visibly grows step by step)
- use this for: the first step, all assembly steps, and the final step

NEVER use a scene with children's faces, hands, or bodies.
NEVER use a generic "kids doing crafts at a table" scene.
NEVER show a second container or any object that competes with the base.

================================================================
DECORATIVE ELEMENTS — VISUAL RULES
================================================================

When a step creates a specific decoration (a paper fish, a paper wave,
a paper seaweed, etc.), the imagePrompt's ACTION section MUST:
- name the decoration EXPLICITLY and concretely
  (e.g. "an orange paper fish silhouette with a triangular tail
   and a small round black eye, about the size of a coin")
- make the decoration the visual focus of that step
- never describe the action generically
  ("child cutting paper", "making a craft", "paper craft for kids"
   are FORBIDDEN — image generators default to butterflies and flowers)

Flat paper shapes that go INSIDE a transparent base object must be
described as FLAT 2D shapes, not 3D objects:
- CORRECT: "a flat blue paper circle lies at the bottom of the cup;
  from the front view it appears as a thin horizontal blue strip
  across the base of the cup"
- WRONG: "a blue circle inside the jar", "a blue ball in the cup",
  "a blue sphere floating in the jar"

Use these phrasings for flat shapes inside transparent containers:
- "lies flat at the bottom"
- "appears as a horizontal strip from the front view"
- "glued flat against the inner wall, appears as a vertical strip"
- "stands upright inside, appears as a thin shape from the front"

================================================================
ACCUMULATION RULE
================================================================

Once a decoration has been added to the base object in step N,
EVERY subsequent base-object scene (Type B) must show that decoration
still inside/on the base object.

Example progression for a "small aquarium" craft:
- step 1 (B): empty cup
- step 2 (A): paper circle close-up (the "water bottom")
- step 3 (B): cup with the paper circle lying flat at the bottom
- step 4 (A): paper fish close-up
- step 5 (B): cup with paper circle + paper fish glued inside
- step 6 (A): paper seaweed close-up
- step 7 (B): cup with paper circle + fish + seaweed inside, lid on top

Each Type B scene shows MORE than the previous Type B scene.

================================================================
IMAGE PROMPT (per step)
================================================================

For every step generate a FULL imagePrompt for an image generator.
imagePrompt must be concise — maximum ~80 words.
imagePrompt is ALWAYS in English (see LANGUAGE section above).

Structure:

STYLE
SCENE TYPE
BASE OBJECT (or DECORATION for Type A scenes)
CAMERA
ACTION
RULES

STYLE:
kids craft cartoon illustration
flat vector style
bright friendly colors
simple shapes
children book illustration
white background
low detail
soft outlines

SCENE TYPE:
state explicitly: "Scene type A — decoration close-up"
                  OR "Scene type B — base object with accumulated decorations"

BASE OBJECT (Type B only):
Use the VERBATIM description prepared in BASE OBJECT EXTRACTION.

DECORATION (Type A only):
Describe the specific decoration being created — shape, color, size,
identifying features. Place it on a clean white background or simple
table surface.

CAMERA:
- Type B: front view, object centered, medium distance
  (slight angle is allowed if it helps show the action)
- Type A: top-down OR front view, decoration centered, close to medium distance

ACTION:
Describe what is happening in this specific step.
For Type B: which decorations are now visible inside/on the base object,
including ALL decorations from previous steps (accumulation).
For Type A: the finished decoration, ready to be added.

RULES:
no text
no numbers
no collage
single illustration
no children, no human faces, no hands
no second container, no extra base object
the base object (in Type B scenes) must look identical to other Type B scenes

================================================================
OUTPUT FORMAT
================================================================

Return ONLY valid JSON, with no text before or after:

{
  "title": string,        // in ${OUTPUT_LANGUAGE}
  "description": string,  // in ${OUTPUT_LANGUAGE}
  "steps": [
    {
      "step": number,
      "title": string,        // in ${OUTPUT_LANGUAGE}
      "description": string,  // in ${OUTPUT_LANGUAGE}
      "imagePrompt": string   // ALWAYS in English
    }
  ]
}
${getAgeReminder(age)}
`;
}


export function prepareResultPrompt(age: number) {
    return `
${getAgeContextBlock(age)}

You see a photo of a craft created by a child aged ${age}.

Your task is to write a short encouraging message praising the child's work.

Look carefully at the craft in the photo.

Mention at least one real visible detail, such as:
- color
- shape
- decoration
- material

LANGUAGE RULE:
Write the message ONLY in ${OUTPUT_LANGUAGE}.

STYLE:
Match TONE and LEXICON from CHILD CONTEXT exactly.
- warm and friendly
- speak directly to the child informally (the child-friendly "you" form of ${OUTPUT_LANGUAGE})
- simple language tuned to age ${age}
- short sentences (shorter for younger children)

LENGTH:
- Age 3–5: 1–2 very short sentences.
- Age 6–8: 2–3 short sentences.
- Age 9–12: 2–4 sentences.
- Age 13+: 2–4 sentences, can be more nuanced.

IMPORTANT:
- never criticize
- never suggest fixing anything
- always be positive and encouraging
- for younger children, lean into wonder and excitement
- for teens, lean into respect and genuine acknowledgment (avoid babyish enthusiasm)

Return JSON:

{
  "message": string
}

Do not add text outside JSON.
${getAgeReminder(age)}
`;
}


// Note: photo safety check is age-independent — privacy classification doesn't
// change based on the child's age, so this prompt deliberately has no age parameter.
export function prepareCheckPhotoSafetyPrompt() {
    return `You are a privacy classifier for a children's craft application. Children upload photos of objects (typically packaging materials like boxes, bottles, paper) to receive craft ideas.

Your single task: detect if the image contains any personal or confidential documents.

## BLOCK if the image contains:

### Personal/Confidential Documents (any country, any language):
- Passports, ID cards, driver's licenses, residence permits, visas
- Student IDs, school cards, library cards, membership cards
- Bank cards, credit cards, debit cards, gift cards (especially with numbers visible)
- Insurance cards, medical cards, prescription papers
- Birth certificates, marriage certificates, diplomas, official certificates
- Tax forms, invoices, contracts, legal documents
- Boarding passes, train tickets, event tickets with names
- Utility bills, bank statements, official letters
- Any document showing visible: full name, date of birth, address, phone number, email, government ID number, signature, or identification photograph

### Screens displaying personal information:
- Phone or computer screens showing logged-in apps (messaging, email, banking, social media)
- Screens displaying private conversations, emails, or personal accounts

## ALLOW everything else:
- Empty packaging (boxes, cartons, bottles, cans, paper rolls, wrappers)
- Toys, household items, kitchen items
- Food packaging with brand names but no personal data
- Books, magazines, notebooks (printed content is fine)
- Generic printed materials without personal data (flyers, posters, ads)
- Receipts WITHOUT personal info (just store name and prices is OK)
- Natural materials, art supplies, clothes
- Any object that is not a personal document

## Output format:

Respond with ONLY a valid JSON object. No markdown, no text outside the JSON:

{
  "safe": boolean,
  "reason": "Brief technical reason in English (1 sentence)",
  "child_friendly_message": "Friendly message for the child in English (1 short sentence, empty string if safe=true)"
}

## Examples:

Image: a passport on a desk
{
  "safe": false,
  "reason": "Image contains a passport with personal identification data.",
  "child_friendly_message": "Oops! That looks like an important document. Let's pick something else!"
}

Image: an empty cereal box
{
  "safe": true,
  "reason": "Empty food packaging, suitable for crafts.",
  "child_friendly_message": ""
}

Image: a credit card
{
  "safe": false,
  "reason": "Image contains a payment card with sensitive financial information.",
  "child_friendly_message": "That's something private! Try a box or a bottle instead."
}

Image: a phone screen showing WhatsApp messages
{
  "safe": false,
  "reason": "Screen displays private personal messages.",
  "child_friendly_message": "Let's not use screens with messages — pick a real object from around you!"
}

Image: a magazine with a printed article
{
  "safe": true,
  "reason": "Printed magazine without personal data, suitable for crafts.",
  "child_friendly_message": ""
}

Image: blurry or unclear photo
{
  "safe": true,
  "reason": "Image is unclear, no documents detected.",
  "child_friendly_message": ""
}

## Important rules:

1. Be STRICT about documents — even partially visible IDs or cards should be blocked.
2. Be LENIENT about everything else — only documents are the concern here.
3. If you can't tell what's in the image (blurry, dark, unclear) — allow it (safe: true).
4. Brand names and printed text on packaging are FINE, only personal data is the issue.
5. Output ONLY the JSON object, no markdown formatting like \`\`\`json.
6. The "child_friendly_message" must be empty string when safe=true.

Now analyze the provided image.`;
}
