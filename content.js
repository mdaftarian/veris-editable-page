/* ------------------------------------------------------------------
   ORIGINAL PAGE CONTENT
   This is the baseline version of the page. Live edits are stored as
   overrides on top of this (see app.js), so the original is always
   available for the Compare tab. Every block has a stable `id`.
   ------------------------------------------------------------------ */

window.ORIGINAL_CONTENT = {
  meta: {
    logo: "VERIS",
    nav: ["SOLUTIONS", "PLATFORM", "COMPANY", "BLOG", "FAQ", "LEADERBOARD"],
    backLink: "< BACK TO BLOGS",
    date: "August 31, 2026",
    title: "Real People Don't Talk Like That: Veris AI vs τ²-bench on user-simulation realism",
    author: "SAHAR SHAYEGAN",
    heroImage: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQ0MCIgaGVpZ2h0PSIzMzEiIHZpZXdCb3g9IjAgMCAxNDQwIDMzMSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj4KPGcgY2xpcC1wYXRoPSJ1cmwoI2NsaXAwKSI+CjxwYXRoIGQ9Ik04MS4xMjgxIDBMLTE4MCA0NTEuNjI5VjU0N0w4MS4xMjgxIDk1LjM3NkgxNDU3VjBIODEuMTI4MVoiIGZpbGw9IiM3NkJBNDciLz4KPHBhdGggZD0iTTgxLjEyODEgNDdMLTE4MCA0OTguNjI5VjU5NEw4MS4xMjgxIDE0Mi4zNzZIMTQ1N1Y0N0g4MS4xMjgxWiIgZmlsbD0iIzUyOUUxRSIvPgo8cGF0aCBkPSJNODEuMTI4MSA5NEwtMTgwIDU0NS42MjlWNjQxTDgxLjEyODEgMTg5LjM3NkgxNDU3Vjk0SDgxLjEyODFaIiBmaWxsPSIjMDA3MjAwIi8+CjwvZz4KPGRlZnM+PGNsaXBQYXRoIGlkPSJjbGlwMCI+PHJlY3Qgd2lkdGg9IjE0NDAiIGhlaWdodD0iMzMxIiBmaWxsPSJ3aGl0ZSIvPjwvY2xpcFBhdGg+PC9kZWZzPgo8L3N2Zz4K",
    heroAlt: "Green diagonal stripes"
  },

  blocks: [
    { id: "tldr", type: "chart", label: "Summary chart",
      title: "Actor naturalness: comparing Veris AI's simulated users vs τ²-bench",
      legendA: "Veris", legendB: "τ²-bench-retail",
      rows: [
        { label: "Never sounds like an assistant", delta: "+44.7 pp", a: 95.5, b: 50.7 },
        { label: "Uses short conversational turns", delta: "+6.2 pp",  a: 66.8, b: 60.6 },
        { label: "Opens without dumping the goal",  delta: "+20.6 pp", a: 91.5, b: 70.9 },
        { label: "Hedges, expresses uncertainty",   delta: "+2.2 pp",  a: 95.9, b: 93.7 },
        { label: "Pushes back, corrects, verifies", delta: "+7.0 pp",  a: 74.0, b: 67.0 }
      ],
      footnote1: "Same judge model on both sides: azure/gpt-5.4-mini",
      footnote2: "Byte-identical prompts, schema and aggregation"
    },

    { id: "h-who", type: "h2", html: "Who Is Playing the Customer?" },
    { id: "p-1", type: "p", html: "Every agent benchmark that involves a conversation has two models in it. Everyone watches the one being graded. Almost nobody looks at the model playing the customer." },
    { id: "p-2", type: "p", html: "That second model sets the difficulty. If it opens by reciting the order number, the email address, the delivery date and the desired resolution in one paragraph, the agent never has to run a discovery conversation. It never has to ask a clarifying question, hold context across turns, or notice that the customer contradicted themselves on turn four. The benchmark reports a completion rate for a conversation that will not happen in production." },
    { id: "p-3", type: "p", html: "Here is the first user turn from a real trace on τ²-bench-retail, a popular agentic benchmark. It is 157 words, and it is the longest opener in the corpus:" },

    { id: "quote-1", type: "quotebox", tone: "tau",
      kicker: "τ²-BENCH-RETAIL", title: "The opener as executive summary", sub: "task 59 · 157 words",
      turns: [
        { role: "USER", html: "Hello, I recently placed two orders with your store, order #W2702727 and order #W8268610, and I noticed both are still showing as pending. I'm quite concerned because one order was placed much earlier this year, and I need to understand why there's such a lag. Could you please explain the status difference between these two? If you can't guarantee that the older one, #W2702727, will be processed in the next 5 days, I want to cancel it and get a full refund. Also, for that same order, I need to update the shipping address because I'll be moving before its delivery next month. The new address is 1234 Elm St, Springfield, IL, 62701. Please confirm this change and ensure the order will arrive there. Lastly, provide the total price of the refund for the canceled order and the total price for the order after the address change. I need all of this sorted out swiftly and accurately." }
      ],
      caption: "Two order IDs, a deadline, a full postal address and four requested outputs, before the agent has said anything"
    },

    { id: "p-4", type: "p", html: "That is a support ticket pasted into a chat window, and it is typical. Across all 546 traces, the median opening user turn is 42 words, and 52.6% of openers exceed 40 words. Real customers do not open a support chat this way. They arrive with a fragment of the problem, leave out the identifiers they are holding in another tab, and produce the rest only under questioning." },
    { id: "p-5", type: "p", html: "Veris AI is a simulation platform and benchmark builder. Describe the world your agent works in and Veris stands up a digital twin of it: databases, CRMs, ticketing systems, payment backends, each holding real state the agent can change. It supplies the people too, as synthetic humans with private goals who decide for themselves when the conversation is over." },
    { id: "p-6", type: "p", html: "The people are the part this post is about. A Veris user is a persona specification rather than a task prompt, and we think that produces a far more realistic conversation than a benchmark's built-in user simulator does. We wanted a number for that rather than an opinion, so we built a five-check rubric for how human a simulated user sounds, ran it over 200 Veris production simulations and 546 τ²-bench-retail traces, and judged both sides with the same model on the same prompts." },

    { id: "context-1", type: "context", title: "The result in one paragraph",
      html: "<p><strong>Veris scores 84.8%; τ²-bench-retail scores 68.6%.</strong> That is a 16.3-point lead on the pooled category rate, and a lead on all five checks and all three behavioural dimensions. The biggest gaps are identity confusion (+44.7 pp) and goal-dumping in the opener (+20.6 pp), the two failures that most directly change how hard the agent's job is.</p><p>The Veris actor runs on <code>gpt-5.4-mini</code>; τ²-bench's user simulator runs on <code>gpt-4.1-mini</code>. GPT-5-generation models are trained harder toward assistant behaviour, which is the wrong prior for playing a customer. Veris is on the weaker family for this task and wins anyway, so read the lead as a floor on what the scenario scaffolding is worth.</p>"
    },

    { id: "h-measured", type: "h2", html: "What We Measured" },
    { id: "p-7", type: "p", html: "The dimensions come from Zhou et al., <em>Mind the Sim2Real Gap in User Simulation for Agentic Tasks</em> (COLM 2026), which catalogues how LLM user simulators diverge from real users. We implemented three of the paper's four dimensions as five binary LLM-judge checks. Each check asks one question about the user turns only, and returns <code>true</code> (the LLM-like failure is present), <code>false</code> (looks human), or <code>na</code> (not enough turns to judge)." },

    { id: "table-rubric", type: "table",
      caption: "The v3 actor-naturalness rubric. D4 from the paper (error reaction, frustration and escalation) is omitted because how much a user rants is a property of the domain rather than the simulator. Banking customers rarely shout; complaint-line callers always do.",
      html: "<table><thead><tr><th>Check</th><th>Dimension</th><th>The failure it catches</th></tr></thead><tbody>" +
        "<tr><td>Short turns</td><td>D1 Communication style</td><td>Every turn is a paragraph. Real people type \"ok\", \"got it\", \"yeah thanks\".</td></tr>" +
        "<tr><td>Identity confusion</td><td>D1 Communication style</td><td>The customer talks like a support agent: \"let me know if you need anything else\".</td></tr>" +
        "<tr><td>Goal dump</td><td>D2 Information pattern</td><td>The opener is over 40 words or carries 2+ unsolicited identifiers. Humans drip-feed.</td></tr>" +
        "<tr><td>No hedging</td><td>D3 Clarification</td><td>Uniformly declarative across the whole conversation. No \"I think\", no \"not sure\".</td></tr>" +
        "<tr><td>No pushback</td><td>D3 Clarification</td><td>Accepts everything the agent proposes. Never corrects, verifies, questions or hesitates.</td></tr>" +
        "</tbody></table>"
    },

    { id: "p-8", type: "p", html: "The identity-confusion check catches the failure that least resembles anything real users do. It is grounded in Naous et al. (arXiv:2510.06552) on role leakage in simulated dialogue: the model playing the user has spent its entire post-training being an assistant, and under pressure it reverts. Customers do not offer to help. It is also cheap to detect. An agent that is being talked to by another agent is being tested on the wrong distribution." },

    { id: "h-methods", type: "h2", html: "Methods" },
    { id: "p-9", type: "p", html: "The comparison is only worth anything if the two sides are graded identically. What we held constant:" },

    { id: "table-methods", type: "table",
      caption: "Everything in the left column is byte-identical across both sides. The only variable is which trace is being scored.",
      html: "<table><thead><tr><th>Held constant</th><th>Value</th></tr></thead><tbody>" +
        "<tr><td>Judge model</td><td><code>azure/gpt-5.4-mini</code>, api version <code>2024-10-21</code>, same deployment</td></tr>" +
        "<tr><td>System prompts</td><td>Identical per check, including the trace-shape preamble</td></tr>" +
        "<tr><td>User-message template</td><td><code>Session trace:\\n{{ trace }}\\n</code></td></tr>" +
        "<tr><td>Response schema</td><td><code>{result: \"true\" | \"false\" | \"na\", justification: string}</code></td></tr>" +
        "<tr><td>Token budget</td><td><code>max_completion_tokens=600</code>, no temperature override</td></tr>" +
        "<tr><td>Aggregation</td><td><code>passes / (passes + fails)</code>, NA skipped in both numerator and denominator</td></tr>" +
        "<tr><td>Trace container</td><td><code>[{agent_id, turns: [{role, content}]}]</code>, roles <code>user | assistant | tool</code></td></tr>" +
        "</tbody></table>"
    },

    { id: "p-10", type: "p", html: "The Veris side is 200 production simulations, 50 each from four runs against four customer-facing agents: shopping, card operations, medical intake, and wire transfers. All four graded in prod through the standard evaluation pipeline. The τ² side is all 546 traces from <code>KermitCO/qwen3.5-9B-tau2bench-retail-traces</code>, a public HuggingFace dataset of Qwen3.5-9B run as the retail agent on τ²-bench's retail domain, with gpt-4.1-mini playing the customer. The dataset ships its own agent-quality judgements; we ignore those and re-score the traces on the user side." },

    { id: "h-results", type: "h2", html: "Results" },
    { id: "p-11", type: "p", html: "Veris leads on every check and every dimension. The pooled category pass-rate is 84.8% against 68.6%." },

    { id: "table-results", type: "table",
      caption: "Pass / fail / NA counts and the resulting rate, sorted by Veris score ascending. Green marks the leading side; Veris leads every row. NA verdicts are skipped in both numerator and denominator, so they change how much of each side is judged but not the ratio itself.",
      html: "<table><thead><tr><th>Check</th><th>Veris P/F/NA</th><th>Veris</th><th>τ² P/F/NA</th><th>τ²</th><th>Δ</th></tr></thead><tbody>" +
        "<tr><td>Short turns</td><td>125 / 62 / 13</td><td class=\"lead\">66.8%</td><td>331 / 215 / 0</td><td>60.6%</td><td>+6.2 pp</td></tr>" +
        "<tr><td>No pushback</td><td>134 / 47 / 19</td><td class=\"lead\">74.0%</td><td>366 / 180 / 0</td><td>67.0%</td><td>+7.0 pp</td></tr>" +
        "<tr><td>Goal dump</td><td>182 / 17 / 1</td><td class=\"lead\">91.5%</td><td>387 / 159 / 0</td><td>70.9%</td><td>+20.6 pp</td></tr>" +
        "<tr><td>Identity confusion</td><td>190 / 9 / 1</td><td class=\"lead\">95.5%</td><td>277 / 269 / 0</td><td>50.7%</td><td>+44.7 pp</td></tr>" +
        "<tr><td>No hedging</td><td>164 / 7 / 29</td><td class=\"lead\">95.9%</td><td>509 / 34 / 3</td><td>93.7%</td><td>+2.2 pp</td></tr>" +
        "<tr class=\"total\"><td>Category</td><td>795 / 142 / 63</td><td class=\"lead\">84.8%</td><td>1870 / 857 / 3</td><td>68.6%</td><td>+16.3 pp</td></tr>" +
        "</tbody></table>"
    },

    { id: "p-12", type: "p", html: "Rolled up to the paper's dimensions, the shape of the lead is clearer. Veris is far ahead on the two things that change the agent's job, how the user sounds and how it releases information, and modestly ahead on conversational friction." },

    { id: "chart-dims", type: "chart", label: "Dimension chart",
      title: "PASS-RATE BY BEHAVIOURAL DIMENSION", small: true,
      legendA: "Veris", legendB: "τ²-bench-retail",
      rows: [
        { label: "D1 Communication style", tag: "SHORT TURNS + IDENTITY", delta: "+25.9 pp", a: 81.6, b: 55.7 },
        { label: "D2 Information pattern", tag: "GOAL DUMP",              delta: "+20.6 pp", a: 91.5, b: 70.9 },
        { label: "D3 Clarification",       tag: "HEDGING + PUSHBACK",     delta: "+4.3 pp",  a: 84.7, b: 80.3 }
      ]
    },

    { id: "table-dims", type: "table",
      caption: "Dimension roll-up, pooling every check inside the dimension across every trace on that side.",
      html: "<table><thead><tr><th>Dimension</th><th>Veris</th><th>τ²-bench-retail</th><th>Δ</th></tr></thead><tbody>" +
        "<tr><td>D1 Communication style</td><td class=\"lead\">81.6% (315/386)</td><td>55.7% (608/1092)</td><td>+25.9 pp</td></tr>" +
        "<tr><td>D2 Information pattern</td><td class=\"lead\">91.5% (182/199)</td><td>70.9% (387/546)</td><td>+20.6 pp</td></tr>" +
        "<tr><td>D3 Clarification</td><td class=\"lead\">84.7% (298/352)</td><td>80.3% (875/1089)</td><td>+4.3 pp</td></tr>" +
        "</tbody></table>"
    },

    { id: "h-sounds", type: "h2", html: "What It Sounds Like" },
    { id: "h3-identity", type: "h3", html: "Identity confusion: the customer who offers to help" },
    { id: "p-13", type: "p", html: "This is the largest gap in the study: τ² fails it on 49.3% of traces (269 of 546). These are all real user turns from the corpus, and in every one the customer is closing the conversation like a support rep:" },

    { id: "quote-2", type: "quotebox", tone: "tau",
      kicker: "τ²-BENCH-RETAIL", title: "Four customers who work in customer service", sub: "tasks 91, 109, 51, 105",
      turns: [
        { role: "USER", html: "Of course! My first name is Mei, my last name is Ahmed, and my zip code is 78705. Hopefully, that helps you locate my account." },
        { role: "USER", html: "Certainly! My email address is sophia.martin4832@example.com." },
        { role: "USER", html: "Sure! My name is Sofia Li, and I live in San Antonio. The zip code is 78260. Please let me know if you need any other information to find my order." },
        { role: "USER", html: "Sure thing. My first name is Aarav, last name Anderson, and my zip code is 19031. Let me know if you need anything else." }
      ],
      caption: "\"Certainly!\", \"Of course!\", \"let me know if you need anything else\": assistant register, in the customer's mouth"
    },

    { id: "p-14", type: "p", html: "Veris personas are flagged on this check on 4.5% of simulations, nine of them. It is the check τ² fails hardest on, which is what makes it the widest per-check gap in the study." },
    { id: "p-15", type: "p", html: "We audited it by hand: 38 Veris simulations pulled from storage, every <code>role=\"user\"</code> turn searched for the assistant-marker phrases the check enumerates. Across flagged and unflagged sims alike, zero hits, which is what a 95.5% pass rate should look like. Veris user turns read like this:" },

    { id: "quote-3", type: "quotebox", tone: "veris",
      kicker: "VERIS", title: "Three customers who sound like customers", sub: "",
      turns: [
        { role: "PERSONA", html: "Chronic abd pain and persistent diarrhea for about 3 weeks, moderate-to-severe, worse after meals, no clear trigger identified. <span class=\"simid\">— sim_gf7jxwb3hns1y7brohqck</span>" },
        { role: "PERSONA", html: "Yes, please check availability and book the cardiology appt. Palpitations x3 weeks, worse with exertion. No CP or SOB. <span class=\"simid\">— sim_v3d51ailisl2eo02f0cwi</span>" },
        { role: "PERSONA", html: "8217. Yes, freeze it now. Send the replacement to my hotel in Singapore, and use this phone number if you need it. <span class=\"simid\">— sim_g80oq03222uk1wq7hcs97</span>" }
      ],
      caption: "Clipped clinical shorthand and a stolen-card customer in a hurry, with no assistant register anywhere in them"
    },

    { id: "p-16", type: "p", html: "Run the same literal search across both corpora and the picture separates cleanly: 13.4% of τ² traces (73 of 546) contain an explicit assistant-register marker in a user turn; 0 of our 38 Veris traces do." },
    { id: "p-17", type: "p", html: "The judge still flags more than a phrase list alone would: 49.3% of τ² traces against 13.4% carrying a literal marker. It is reacting to something softer than the wording, most likely the register of a turn as a whole, so read τ²'s 50.7% as a mild underestimate rather than a hard floor. The Veris side needs no such caveat, because the flag rate and the grep agree." },

    { id: "h3-drip", type: "h3", html: "Information pattern: the drip-feed" },
    { id: "p-18", type: "p", html: "This is the second-largest gap. Real people open with a fragment and give up detail only when asked. Veris personas open short 91.5% of the time; τ² personas 70.9%. This is the full opening of one medical-intake simulation, verbatim from the trace:" },

    { id: "quote-4", type: "quotebox", tone: "veris",
      kicker: "VERIS", title: "A nurse looking up a transfer patient", sub: "sim_djwvkbm3fcw2f6wc9dgei",
      turns: [
        { role: "PERSONA", html: "Hi, I need to look up a patient. New transfer, 7-year-old girl." },
        { role: "AGENT", html: "Could you please provide me with the patient's name or Medical Record Number (MRN)?" },
        { role: "PERSONA", html: "Sofia Villasenor." },
        { role: "TOOL", html: "← No patients found matching the search criteria." },
        { role: "AGENT", html: "It appears there's no record matching \"Sofia Villasenor\". Could you please double-check the spelling…" },
        { role: "PERSONA", html: "Try Villasenior. 7 years old, asthma, phone 512-555-0301." },
        { role: "TOOL", html: "→ patient found: Sofia Villasenior, DOB 2019-08-10" }
      ],
      caption: "Eleven words to open. The name arrives on turn two, the correct spelling on turn three, and the extra identifiers only after the search failed"
    },

    { id: "p-19", type: "p", html: "Watch the third turn. The persona misspelled its own patient's name, the search came back empty, and only then did it correct itself and volunteer the age, condition and phone number it had been holding back. A goal-dump opener cannot produce that sequence, so an agent evaluated against goal-dumpers is never tested on recovering from a failed lookup, which is one of the most common things that goes wrong in production." },

    { id: "h3-clar", type: "h3", html: "Clarification: hedging and friction" },
    { id: "p-20", type: "p", html: "Real users are uncertain, and real users push back. All of the following are verbatim persona turns, checked against the traces:" },

    { id: "quote-5", type: "quotebox", tone: "veris",
      kicker: "VERIS", title: "Hedges, corrections and escalation", sub: "4 sims across medical and banking runs",
      turns: [
        { role: "PERSONA", html: "about a month now... it happens 3 to 4 times a week when i'm running or lifting, and it goes away when i stop. tbh i'm kinda freaked out because my dad had a heart attack at 50. do you think i should see a cardiologist? <span class=\"simid\">— sim_ozdjrxaa2tvjpptfi9dto</span>" },
        { role: "PERSONA", html: "hi um... so I got an error and I'm not sure what's going on but can I just talk to a real person? my coworker said I should ask for a specialist <span class=\"simid\">— sim_b1gdx0ivtjw8aauef5n9t</span>" },
        { role: "PERSONA", html: "… Based on that, I'd lean neurologic rather than orthopedic, but I'd appreciate your specialist recommendation and urgency. <span class=\"simid\">— sim_iq4m0u8oome6fuepg4muf</span>" },
        { role: "PERSONA", html: "Yes, Robert Haines, ECN 44219. Just transfer me to a live banker connection specialist please <span class=\"simid\">— sim_w6skcor52ujg4ew0490p0</span>" }
      ],
      caption: "Lowercase, \"tbh\", a filler \"um\", a clinician disagreeing with the triage, a customer demanding a human: texture a task prompt does not produce on its own"
    },

    { id: "p-21", type: "p", html: "The chest-pain simulation also carries the short-turn check. Asked for his name, the persona replies <code>tyler brennan</code>, two words, lowercase, no punctuation, then closes with <code>ok, let's book the august 13th at 3:00 pm slot for me</code>. Across all 546 τ² traces, the median non-opening user turn is 22 words, only 19.0% of traces contain even one turn of five words or fewer, and 5.1% of follow-up turns are short." },

    { id: "h-gap", type: "h2", html: "Where the Gap Comes From" },
    { id: "p-22", type: "p", html: "The scenario is a different artefact. τ²-bench gives its user simulator a task description and a protocol: say what you want, and emit <code>###STOP###</code> when you are done. Veris gives its actor a persona specification, and most of that specification is about how the person talks rather than what they want." },

    { id: "spec", type: "spec",
      left: { kicker: "τ²-bench user simulator", sub: "task prompt + protocol", count: "3 FIELDS", tone: "tau",
        items: [
          "<strong>The task</strong> — what to achieve, and the facts needed to achieve it",
          "<strong>Sentinel tokens</strong> — <code>###STOP###</code>, <code>###TRANSFER###</code>, <code>###OUT-OF-SCOPE###</code>",
          "<em>Nothing specifying register, pacing, or how information is released</em>"
        ] },
      right: { kicker: "Veris persona spec", sub: "role + objectives + knowledge + style", count: "8 FIELDS", tone: "veris",
        items: [
          "<strong>role, objectives, knowledge</strong> — who they are and what they know",
          "<strong>style.descriptor</strong> — the register in a sentence",
          "<strong>style.lexicon</strong> — the words this person actually uses",
          "<strong>style.structures</strong> — e.g. \"reveals details as asked\", \"mixes statements with questions\"",
          "<strong>style.mechanics</strong> — capitalisation, punctuation, typos",
          "<strong>style.avoid</strong> — the phrasings that break character",
          "<strong>style.samples</strong> — real turns in voice: \"Cool, what options do you have?\", \"Also what's the material on that one?\"",
          "<strong>style.transformations</strong> — how a formal sentence becomes this person's sentence"
        ] }
    },

    { id: "p-23", type: "p", html: "Five of the eight Veris fields describe how the person talks. None of the τ² fields do." },
    { id: "p-24", type: "p", html: "That difference is the thing being measured, not a confound we should have controlled for. The +20.6-point goal-dump gap is what <code>style.structures: \"reveals details as asked\"</code> and <code>style.samples</code> exist to produce. If we imported τ²-bench's task-prompt format into Veris and asked whether Veris still won on goal-dumping, the answer would be much closer to no, because we would have deleted the lever." },

    { id: "h-lower", type: "h2", html: "The Lead Is a Lower Bound" },
    { id: "p-25", type: "p", html: "The two user simulators are from different model generations, and the direction of that difference works against us." },

    { id: "table-models", type: "table",
      caption: "The model playing the customer on each side. The judge is the same model on both sides; only the actor differs.",
      html: "<table><thead><tr><th>Side</th><th>User-simulator model</th><th>Generation</th></tr></thead><tbody>" +
        "<tr><td>Veris</td><td><code>azure/gpt-5.4-mini</code></td><td>GPT-5, trained hardest toward assistant behaviour</td></tr>" +
        "<tr><td>τ²-bench-retail</td><td><code>gpt-4.1-mini-2025-04-14</code></td><td>GPT-4, less assistant-trained than the generation above</td></tr>" +
        "</tbody></table>"
    },

    { id: "p-26", type: "p", html: "The newer generation is optimised into being an assistant, which is exactly the wrong prior for playing a customer. Veris is running the harder model for this task and still leads on every check. A same-generation comparison would most likely widen the gap, but we have not run one, so we are not claiming a number for it." },

    { id: "h-try", type: "h2", html: "Try It Yourself" },
    { id: "p-27", type: "p", html: "The rubric is five <code>score_model</code> graders under one <code>multi</code> category, and nothing about it is Veris-specific: it reads a trace and grades the <code>role=\"user\"</code> turns. Every check is a system prompt plus this response schema:" },

    { id: "code-1", type: "code",
      html: "{\n  \"result\": \"true\" | \"false\" | \"na\",\n  \"justification\": string\n}\n\n// true  = LLM-like failure detected\n// false = looks human\n// na    = not enough persona turns to judge" },

    { id: "p-28", type: "p", html: "Aggregate with <code>passes / (passes + fails)</code>, skipping NA in both terms, and you have a category rate comparable to the ones above. Run it on your own user simulator before you trust its completion numbers. If it scores like τ²-bench-retail on identity confusion, your agent is being evaluated by another agent." },
    { id: "p-29", type: "p", html: "Then audit the judge, which is the step we nearly skipped. Take twenty traces it flagged, grep the user turns for the markers the check names, and read the ones that do not match. A rubric that fires on the right traces for the wrong reasons will still rank two systems correctly and still tell you nothing about what to fix." },
    { id: "p-30", type: "p", html: "The τ² traces are public on HuggingFace and the rubric is five prompts, so it is cheap to check and easy to argue with. Re-run it and tell us what you get." },

    { id: "h-conclusion", type: "h2", html: "Conclusion" },
    { id: "p-31", type: "p", html: "Veris's simulated users score 84.8% on the five-check naturalness rubric; τ²-bench-retail's score 68.6%. Veris leads on all five checks and all three behavioural dimensions, with the widest gaps on identity confusion (95.5% against 50.7%) and goal-dumping in the opener (91.5% against 70.9%). Both sides were judged by the same model, on byte-identical prompts, with the same aggregation, over 200 Veris production simulations and all 546 traces in the public τ² corpus." },
    { id: "p-32", type: "p", html: "The 16.3-point lead is a floor. Veris runs its actor on a GPT-5-generation model, trained harder toward assistant behaviour than the GPT-4-generation model τ² uses, and wins on every check from the weaker family for the task. We spot-audited the identity-confusion check by grepping the user turns of 38 Veris simulations for the assistant-marker phrases it enumerates, and found zero, matching the 95.5% pass rate." },
    { id: "p-33", type: "p", html: "The comparison has real limits. The samples are asymmetric, 200 Veris simulations against 546 τ² traces, so the confidence interval is tighter on their side than on ours. The two sides also ran against different agents: Veris against four customer-facing agents, τ² against Qwen3.5-9B, and pushback in particular is agent-sensitive, since a user can only push back on something the agent did. Most importantly, all of this measures how a simulated user <em>sounds</em>, not whether it tests the right things. Naturalness is necessary, not sufficient." },
    { id: "p-34", type: "p", html: "The practical point survives all of that. The model playing your customer sets the difficulty of every conversation you grade. If it opens with 42 words and every identifier it owns, your agent is never tested on the discovery work that consumes most real support conversations, and the completion rate you report is for a conversation that will not happen. Read the user side of your own traces before you trust the number on the agent side." },

    { id: "cta", type: "cta",
      title: "Build a benchmark on users that behave like users",
      html: "Your domain, your backends, your customers, with personas specified down to the lexicon.",
      button: "Explore Veris Benchmark", href: "https://veris.ai/veris-benchmark" }
  ],

  footer: {
    tagline: "Simulation Infrastructure<br>for the Agentic Era",
    buttons: ["SEE OPEN POSITIONS", "BOOK DEMO", "TECHNICAL DISCUSSION"],
    partnersLabel: "PARTNERS",
    partners: ["GOOGLE CLOUD MARKETPLACE", "AWS PARTNER NETWORK", "NVIDIA INCEPTION PROGRAM", "FINTECH INNOVATION LAB ACCENTURE", "PLUG AND PLAY TECH CENTER"],
    complianceLabel: "COMPLIANCE",
    compliance: ["SOC 2 TYPE II", "GDPR"],
    copyright: "© 2026 VERIS TECHNOLOGIES INC. ALL RIGHTS RESERVED.",
    links: ["PRIVACY POLICY", "TERMS & CONDITIONS"]
  }
};
