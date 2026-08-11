# The Skill Spec Doesn't Care How Busy You Are

A while back I wrote about the Prompt Optimizer, a multi-agent pipeline that treats prompt engineering as something you build from first principles instead of something you eyeball until it feels right. This piece is a companion, one level up the stack. That one covered writing a good prompt. This one covers building a capability around it.

Anthropic's Agent Skills spec is a good idea. A Skill is a self-contained bundle: a `SKILL.md` file plus whatever scripts, references, or assets it needs, built to tell an agent how to do one thing well and when to reach for it. It's a clean abstraction, and like most clean abstractions it comes with rules. The folder name and the frontmatter `name` field have to be kebab-case, and they have to be identical. The `description` field is capped at 1,024 characters and can't contain angle brackets, because those collide with how the field gets parsed downstream. The main file is supposed to stay lean, with deeper detail pushed into a `references/` folder instead. It's routine if you build agent tooling for a living, and a wall if you don't.

This split shows up once you try to package expertise into an Agent Skill.

## The old workflow

Say you're a domain expert: a paralegal, a research analyst. You know what you want an AI agent to be good at, and you don't want to write another one-off prompt. You want to package that expertise into something an agent can reuse.

Under the old workflow, your path runs through the spec, and the rules don't throw a clear error when you get them wrong. Miss the character limit on the description, or leave in a stray angle bracket, and nothing crashes. What I've seen instead: the skill doesn't trigger, or triggers at the wrong moment, and you're left debugging a capability that stopped working with no error telling you why.

Fair enough. But you didn't sit down to learn spec syntax. You wanted to encode your expertise, and instead you're proofreading YAML formatting rules. It's the same friction as knowing what clause you want in a contract but needing to learn contract law first to write it yourself. Faced with that gap, I'd bet you don't finish. The packaging cost outweighs the payoff, no matter how much expertise you're sitting on.

## The new pattern

AI Skill Creator changes the interface. The spec itself doesn't change. You describe the use case in plain language, in a chat, the way you'd explain it to a colleague: "I want a skill that reviews pull requests for our internal style guide" or "I want something that drafts client status updates from a project tracker export." You even choose which of two Gemini models handles the conversation, without needing to know anything about the spec underneath.

The output is the finished bundle: the folder structure, the `SKILL.md` file, any supporting scripts or reference material the use case calls for, and a sample prompt so you can try it right away. You never open the spec file. The tool has internalized it on your behalf, the same way a good tax-prep product has internalized the tax code so you answer questions about your life instead of parsing statute.

The generation matters less than what happens right after it. The tool checks the result against the same rules it was given: correct kebab-case naming, and a description that's present, under 1,024 characters, and free of the angle brackets that would break parsing. If something's off, it attaches a warning to that chat response, right alongside the bundle. You see it before you hand the skill off to an agent. You fix it by asking, the way you'd ask a collaborator to tighten a paragraph, rather than by re-reading the section of the spec you got wrong.

## See it in action

You can try this yourself at [skill.genaitools.cloud](https://skill.genaitools.cloud/). Describe a use case, watch the bundle come together, and download it.

## The barrier moved

This tool collapses the distance between having the expertise and packaging it right, for someone who has never heard of YAML frontmatter and doesn't need to. You don't need to know the spec exists to end up with a bundle checked against it, warnings surfaced and left for you to fix.

I think this previews where a lot of "how do I build with AI" tooling is heading. Documentation literacy used to be the barrier: read the manual and stay inside its rules. Now the barrier is stating what you want. The manual still exists and the rules still matter. The tool just checks them for you now, behind the interface instead of in front of it as a prerequisite.

I like this shift for the same reason I liked building the Prompt Optimizer as a pipeline instead of a single clever prompt: it lets you use good spec discipline without spending a week learning to write specs.

---

**Disclaimer:** This code is provided "as-is" as a demonstration only to illustrate a potential solution. The code does not constitute a Google product or service of any kind, and Google offers no support, warranties, or liability of any kind with its regard. Whoever chooses to use this code accepts all responsibility related to it, including for its implementation, use, and ongoing maintenance. For the avoidance of doubt, this code is not eligible for the Google Open Source Software Vulnerability Rewards Program.
