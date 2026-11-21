

(function () {
  'use strict';
  var T = window.IETools, L = window.IEToolLogic && window.IEToolLogic.agentIsolation;
  if (!document.getElementById("aim-app")) return;
  if (!T || !L) { document.getElementById("answer-h").textContent = "The rules file did not load. Reload the page to try again."; return; }

   
  var ENG_Q = [
    { key: "a", label: "What does it read that you did not write?", hint: "Aimed: a stranger can choose what it reads, such as public issues, inbound email or open browsing.", opts: [["none", "Nothing"], ["incidental", "Web docs, dependencies, search results"], ["aimed", "Content a stranger can send or point it at"]] },
    { key: "others", label: "Does it run code, repos or add-ons you did not write?", hint: "Cloned repos, packages it picked, MCP servers or plug-ins from the internet.", opts: [[true, "Yes"], [false, "No"]] },
    { key: "exec", label: "Does anything run on your machine for it?", hint: "Shell commands, code, local plug-ins or browser control. Web-only chat usually has none.", opts: [[true, "Yes"], [false, "No"]] },
    { key: "priv", label: "Can it read private data?", hint: "Your source code, email, customer records.", opts: [[true, "Yes"], [false, "No"]] },
    { key: "keys", label: "The worst thing the keys it can reach allow", hint: "The worst action counts, not how long the key lasts. Anything its user account can read counts.", opts: [[0, "Nothing"], [1, "Read-only, or one project"], [2, "Change or delete across your work"], [3, "Admin, production or money"]] },
    { key: "act", label: "Can it change things or send data out?", hint: "git push, delete, send email, any HTTP request. Running code counts as Yes.", opts: [[true, "Yes"], [false, "No"]] },
    { key: "watch", label: "Who is watching?", hint: "Clicking yes without reading counts as auto-approve.", opts: [["every", "I read every action"], ["auto", "Auto-approve"], ["alone", "Runs alone"]] },
    { key: "users", label: "Who shares one running copy of it?", hint: "Only if several people use the same running copy. Your own coding agent is Just me.", opts: [["me", "Just me"], ["staff", "Colleagues"], ["public", "Customers or the public"]] },
    { key: "access", label: "Whose access does it act with?", hint: "One shared account lets anyone who can talk to it reach what that account can.", opts: [["own", "Each user's own"], ["shared", "One shared account"]] },
    { key: "today", label: "What sandbox does it run in today?", hint: "Where you start on the grid, and whether the sandbox needs to change.", opts: [[0, "None"], [1, "OS sandbox"], [2, "Container or VM"], [3, "microVM or gVisor"]], divider: true },
    { key: "gateNow", label: "What human gate is already in place?", hint: "A gate is a step the agent cannot do itself, such as a merge. Auto-approve or an AI reviewer is None.", opts: [[0, "None"], [1, "A person confirms risky actions"], [2, "A gate it cannot bypass"]] },
    { key: "egressNow", label: "What outbound control is already in place?", hint: "An allowlist counts only if the agent cannot route around it; otherwise answer Logged.", opts: [[0, "Open"], [1, "Logged"], [2, "Allowlist of hosts"], [3, "Off, or a tight allowlist"]] }
  ];
  var LEAD_Q = [
    { group: "What it takes in", key: "a", label: "What does it read from outside the team?", hint: "Aimed: a stranger can choose what it reads, such as customer emails or open web browsing.", opts: [["none", "Nothing"], ["incidental", "Reference material: docs, libraries, search"], ["aimed", "Content strangers can send or point it at"]] },
    { key: "others", label: "Does it run code or packages the team did not write?", hint: "Open-source repos, packages it chooses, plug-ins from the internet.", opts: [[true, "Yes"], [false, "No"]] },
    { group: "What it can do, and for whom", key: "exec", label: "Does anything run on staff machines for it?", hint: "Commands, code, local plug-ins or browser control. Coding and browser agents do.", opts: [[true, "Yes"], [false, "No"]] },
    { key: "act", label: "Can it change systems or send data out?", hint: "Deploys, deletes, emails, payments, any outbound request.", opts: [[true, "Yes"], [false, "No"]] },
    { group: "Blast radius", key: "priv", label: "Can it see confidential data?", hint: "Source code, customer records, finances.", opts: [[true, "Yes"], [false, "No"]] },
    { key: "keys", label: "The worst thing its access allows", hint: "Whatever the account it runs under can do. A short admin session still counts as admin.", opts: [[0, "Nothing"], [1, "Read-only, or one project"], [2, "Change or delete across systems"], [3, "Admin, production or money"]] },
    { key: "users", label: "Who shares one running copy of it?", hint: "Only if several people use the same running copy. A developer's own coding agent is One person.", opts: [["me", "One person"], ["staff", "Staff"], ["public", "Customers or the public"]] },
    { key: "access", label: "Whose access does it act with?", hint: "If it uses one shared account, anyone who can talk to it can reach what that account can.", opts: [["own", "Each user's own"], ["shared", "One shared account"]] },
    { group: "Oversight", key: "watch", label: "How is it supervised?", hint: "Approving without reading closely counts as the middle option.", opts: [["every", "A person reads each action"], ["auto", "People approve without reading closely"], ["alone", "Unattended"]] },
    { key: "today", label: "What isolation does it have today?", hint: "Ask the engineers if unsure.", opts: [[0, "None"], [1, "OS sandbox"], [2, "Container or VM"], [3, "microVM or gVisor"]] },
    { key: "gateNow", label: "What approval step is already in place?", hint: "A gate is a step the agent cannot do itself, such as a merge. Auto-approve or an AI reviewer is None.", opts: [[0, "None"], [1, "A person confirms risky actions"], [2, "A gate it cannot bypass"]] },
    { key: "egressNow", label: "What limits on outbound traffic are already in place?", hint: "Ask the engineers if unsure. An allowlist the agent can route around counts only as Logged.", opts: [[0, "Open"], [1, "Logged"], [2, "Allowlist of hosts"], [3, "Off, or a tight allowlist"]] }
  ];
  var SB_Q = [
    { key: "reads", label: "Does it read things from outside your business?", hint: "Emails from customers or suppliers, websites, documents people send you.", opts: [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]] },
    { key: "private", label: "Can it see private information?", hint: "Customer details, finances, staff records, passwords.", opts: [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]] },
    { key: "acts", label: "Can it act on your behalf?", hint: "Send emails, make payments, change your website, delete or move files.", opts: [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]] },
    { key: "signin", label: "Which accounts is it signed into?", hint: "Think about email, banking, your website and cloud storage.", opts: [["none", "None"], ["limited", "One app, limited access"], ["own", "Someone's own work accounts"], ["admin", "Admin or the business's main accounts"], ["unsure", "Not sure"]] },
    { key: "checks", label: "Does someone check what it does before it happens?", hint: "Clicking approve without reading counts as the middle option.", opts: [["every", "Yes, every action"], ["approve", "We approve, usually without reading"], ["alone", "It works on its own"], ["unsure", "Not sure"]] },
    { key: "where", label: "Where does it run?", hint: "Chat and email assistants are usually the supplier's app; coding assistants run on your computer.", opts: [["vendor", "Runs on the supplier's servers (you use a website or app)"], ["computer", "Runs programs or opens files on our own computer"], ["unsure", "Not sure"]] },
    { key: "users", label: "Who talks to it?", hint: "A chatbot on your website talks to anyone on the internet.", opts: [["me", "Only me"], ["staff", "My staff"], ["public", "Customers or the public"], ["unsure", "Not sure"]] },
    { key: "addons", label: "Have you added plug-ins, add-ons or connectors to it?", hint: "Extra features from other companies that link it to other apps.", opts: [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]] }
  ];

  var VIEW_TEXT = {
    eng: { lede: "Pick an agent type, or answer the questions for your own agent. You get its risk level and six settings to put in place. No one setting is enough on its own: a stronger sandbox does not stop an agent misusing the keys it can reach.", note: "For developers and platform teams running coding and other agents.", answer: "Six settings to put in place", copy: "Copy as a checklist", presets: "Start from an agent type" },
    lead: { lede: "Answer the questions for one agent your team uses or plans to use. You get its risk level, a team default you can adopt, and questions to ask your engineers and vendors.", note: "For heads of small and medium organisations and their engineering leads.", answer: "Team default, setting by setting", copy: "Copy the team default", presets: "Start from an agent type" },
    sb: { lede: "Answer eight questions about an AI tool your business uses. You get its risk level, what to do, a rule for your staff and questions for your IT provider. If you don't know an answer, choose Not sure: the advice then assumes the worst.", note: "For owners and staff of small businesses, and the IT provider who helps them.", answer: "What to do about this tool", copy: "Copy the advice and staff rule", presets: "Your AI tool" }
  };

   
  var BOX = ["None, as long as you read each action", "OS sandbox around shell commands", "Container or VM around the whole agent", "microVM or gVisor, one per session"];
  var BOX_SHORT = ["none", "OS sandbox", "container/VM", "microVM"];
  var EGRESS = ["It cannot send anything out", "Allow most sites, and log every one", "Allowlist only the hosts the job needs, enforced below the agent", "Network off or a short allowlist, and remove one risk corner"];
  var EGRESS_API = ["It cannot send anything out", "Log what it sends", "Limit what it can send, and to whom", "Limit what it can send and to whom, and remove one risk corner"];
  var EGRESS_SHORT = ["no sends", "log all", "allowlist", "off/tight"];
  var EGRESS_API_SHORT = ["no sends", "log sends", "limit sends", "limit, split"];
   
  function egressText(s, d) {
    if (d.multi && !(d.B && d.C) && d.e === 2) return ["Network off by default, or only the hosts the job needs", "net off"];
    if (!d.C) return d.e >= 2 ? ["Network off by default", "net off"] : [EGRESS[0], EGRESS_SHORT[0]];
    return s.exec ? [EGRESS[d.e], EGRESS_SHORT[d.e]] : [EGRESS_API[d.e], EGRESS_API_SHORT[d.e]];
  }
  function egressLabel(s, d) { return egressText(s, d)[0]; }
  function boxLabel(s, d) { return !s.exec ? "No code runs on your side, so no sandbox is needed" : BOX[d.m]; }
  var TOOLSET = ["The full toolset is fine", "Deny the riskiest commands: deletes, force pushes, deploys", "Plan and read only; a person or a pipeline makes the changes", "Split it: the part that reads untrusted input gets no tools that act"];
  var GATE = ["Not needed as the main control", "Confirm the few actions that are hard to undo", "A gate it cannot bypass: a merge, a send, a payment"];
  var RECOVER = ["Nothing extra needed", "A log of what it did, which someone reads", "Backups and deletion protection it cannot reach, and a tested way to revoke its access"];
  var KEY_NAMES = ["no keys", "read-only or single-project keys", "keys that can change or delete across your work", "admin, production or payment keys"];

   
  function keysText(s, k) {
    if (L.compute(s).sharedReach && k >= 2 && s.keys < 3) return ["Act with each user's own access, not one shared account", "own access"];
    if (k === 3) return ["It only plans; a person or a reviewed pipeline makes the changes", "plan only"];
    if (k === 2) return ["Brokered, short-lived, scoped keys, held outside its sandbox", "broker keys"];
    if (k === 1) return s.keys === 2 ? ["Deny reads of your own logins; give it repo-scoped tokens", "deny reads"] : ["Keep its keys read-only or to one project", "read-only"];
    return ["No keys: keep logins out of its reach", "no keys"];
  }
  function keysLabel(s, k) { return keysText(s, k)[0]; }
  function joinList(list) { return list.length < 2 ? list.join("") : list.slice(0, -1).join(", ") + " and " + list[list.length - 1]; }

  function boxWhy(s, d) {
    var tail = "";
    if (s.exec && d.m > 0) tail = s.today >= d.m ? " What you run today already meets this." : " That is a step up from what you run today.";
    if (!s.exec) return d.multi ? "It runs no code on your side, so there is no sandbox to build. Make sure each user reaches only their own data." : "It runs no code on your side, so any harm comes through its API calls. A stronger sandbox does little here.";
    if (d.multi) return "Other users share the host, so the sandbox must hold against deliberate attack, not just mistakes." + tail;
    var r = [];
    if (s.watch === "alone") r.push("it runs alone");
    if (s.others) r.push("it runs code you did not write");
    if (d.A && s.watch !== "every") r.push(s.watch === "auto" ? "strangers can aim content at it while it auto-approves" : "strangers can aim content at it");
    if (r.length) return "Because " + joinList(r) + ". Check what your sandbox covers: Claude Code's OS sandbox, for example, wraps shell commands only, not the agent's own tools, hooks and MCP servers." + tail;
    if (s.watch === "auto") return "You auto-approve, so the sandbox does the checking for you. Make sure it cannot quietly fall back to running without one." + tail;
    if (s.keys >= 2) return "Real logins sit on this machine, and agent OS sandboxes allow broad reads by default." + tail;
    if (s.a !== "none") return "It reads content you did not write. Even with you watching, a sandbox catches what you miss." + tail;
    return "Anything that runs code gets at least an OS sandbox: it costs little, and reading every action is less reliable than it feels." + tail;
  }
  function keysWhy(s, d) {
    if (d.sharedReach && s.keys < 3) return "One shared account serves many people, so anyone who can talk to it can reach whatever that account can. Pass each user's own identity through to the systems it calls. Even then, a misled agent can use all of that user's access, so keep each user's access small.";
    if (d.k === 3) return "A stronger sandbox does not limit what an admin key in its reach can do. Let the agent propose changes, and let a step it cannot steer apply them. For exploratory cloud work, a separate account or project with a permission ceiling (on AWS, a service control policy; on Google Cloud, an IAM deny policy) limits the damage. On AWS, cost anomaly alerts can lag up to 24 hours.";
    if (d.k === 2) return "It holds real logins and either reads untrusted input or runs alone. Keep the real secret outside its sandbox.";
    if (d.k === 1 && s.keys === 2) return "Your own logins are reachable. The agent runs as you, so it can read what you can.";
    if (d.k === 1) return "Read-only or single-project keys limit what a misused key can do.";
    if (s.priv) return "No keys are in reach, but it can read private data. Let it read only what the job needs, and keep logins out of its sandbox.";
    return "Nothing worth stealing is in reach. Keep logins out of its sandbox, so a misled agent has nothing to use.";
  }
  function egressWhy(s, d) {
    var chat = d.A && d.B ? " Don't let its replies load images or links automatically: data has leaked that way through hosts any allowlist permits." : "";
    return egressCore(s, d) + chat;
  }
  function egressCore(s, d) {
    if (d.e === 1 && d.B && d.C && s.watch === "every" && !d.A && !d.incidental && !d.multi) return "You read every action and it reads nothing you did not write, so a log is enough. Move to an allowlist once you auto-approve.";
    if (d.e === 3) return "All three risk corners are present. Data can still leak through allowed hosts such as GitHub and the model provider's API, so the stronger fix is to remove one corner.";
    if (d.e === 2 && d.multi && !(d.B && d.C)) return "Shared deployments are safest with the network off by default.";
     
    if (d.e === 2 && s.exec && d.A && s.watch === "alone" && !(d.B && d.C)) return "It runs code alone on input a stranger can aim at, so even with nothing private to leak, it could reach other people's systems. Published reports (WorkOS, UK AISI) describe unattended agents doing this. So far these were agents under test, most of them given security tasks; linking it to input a stranger can aim is this map's own inference. Enforce the allowlist below the agent: no raw sockets, no DNS resolver of its own, no route out except the proxy.";
    if (d.e === 2) return s.priv ? "Private data plus the ability to send is a leak route." : "Real keys plus the ability to send is a leak route: a key it can read, it can send out.";
    if (d.e === 1 && d.A) return "It needs broad web access. Block known exfiltration services and keep a log." + (s.exec && s.watch === "auto" ? " The map asks for an allowlist only when it runs alone, because the published cases of agents reaching other people's systems were unattended. If you approve without reading, treat it as running alone." : "");
    if (d.e === 1) return "A log shows afterwards what it did.";
    return "It cannot send anything out.";
  }
  function toolsetWhy(s, d) {
    var vet = s.others ? " Pin and review third-party plug-ins and servers: no sandbox stops a leak through the API a server exists to call." : "";
    return toolsetCore(s, d) + vet;
  }
  function toolsetCore(s, d) {
    if (d.t === 3) return "With all three risk corners in one agent, separate reading from acting, so injected instructions never reach a tool that sends or deletes. For a coding agent: let the session that reads issues, PRs or the web run without push rights or secrets, and push from a separate step.";
    if (d.t === 2) return "Admin keys plus the ability to act: let it plan, and keep the apply step with a person or a pipeline.";
    if (d.t === 1) return "A short deny list stops the commands that are hard to undo without slowing everyday work.";
    return "The other settings carry the load.";
  }
  function gateWhy(s, d) {
    if (d.g === 2) return "Put approval where the agent cannot reach it. Per-command prompts get rubber-stamped: Anthropic reported in 2026 that users approve about 93% of them.";
    if (d.g === 1) return "Confirm deletes, pushes and sends; everyday commands can run.";
    return "Approval is not the main control here.";
  }
   
  function concreteSteps(s, d) {
    var steps = [];
    if (s.a === "aimed" && !s.exec) steps.push("Stop it reading outside content it was not asked about: calendar invites from strangers, documents shared from outside, inbound email.");
    if (s.a === "aimed" && s.exec) steps.push("Read issues, pull requests or web pages in a session with no push rights and no secrets, and make changes from a separate step.");
    if (d.B) steps.push("Disconnect connectors and data sources it does not need for this job.");
    if (d.C) steps.push("Limit the tools it has and who it can send to; turn off web access where the job does not need it.");
    if (d.A && d.B) steps.push("Stop its replies loading images or links automatically.");
    return steps;
  }
  function recoverWhy(s, d) {
    if (d.r === 2) return "It can change or delete real work. After an agent deleted a production volume, and after a terraform destroy, the fixes were soft deletes, which can be undone for a while, and backups the deleting tool could not touch. Keep backups out of the agent's reach.";
    if (d.r === 1) return "Without a log that someone reads, nobody can tell afterwards what it did.";
    return "It cannot change anything that would need restoring.";
  }
  var SOURCES = {
    m: [["NVIDIA AI Red Team", "https://developer.nvidia.com/blog/practical-security-guidance-for-sandboxing-agentic-workflows-and-managing-execution-risk/"], ["Claude Code sandboxing", "https://code.claude.com/docs/en/sandboxing"], ["NCSC, managing the cyber risk of agentic AI", "https://www.ncsc.gov.uk/sites/default/files/2026-08/Managing-the-cyber-risk-of-agentic-AI_0.pdf"], ["ASD, securing AI testing environments", "https://www.cyber.gov.au/sites/default/files/2026-11/Securing%20AI%20testing%20environments.pdf"]],
    k: [["Five Eyes, careful adoption of agentic AI", "https://www.cyber.gov.au/sites/default/files/2026-05/careful_adoption_of_agentic_ai_services.pdf"], ["Microsoft, agents abusing exposed secrets", "https://www.microsoft.com/en-us/security/blog/2026/11/05/threat-actors-use-agentic-ai-tooling-to-find-and-abuse-exposed-secrets/"], ["AWS service control policies", "https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html"], ["Google Cloud IAM deny policies", "https://docs.cloud.google.com/iam/docs/deny-overview"], ["IAM Identity Center sessions", "https://docs.aws.amazon.com/singlesignon/latest/userguide/howtogetcredentials.html"], ["AWS Cost Anomaly Detection", "https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html"]],
    e: [["The lethal trifecta", "https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/"], ["Claude Code cloud network allowlist", "https://code.claude.com/docs/en/cloud-environments"], ["OpenAI, an agent bypassing network restrictions", "https://alignment.openai.com/misalignment-reports/bypassing-network-restrictions-during-a-coding-evaluation/"], ["UK AISI, unsanctioned agent behaviour", "https://www.aisi.gov.uk/blog/incident-report-unsanctioned-agent-behaviour-during-cyber-testing"], ["WorkOS security bulletin, 2026-11-06", "https://workos.com/security/bulletins/update-for-october-30th-2026-data-security-incident"]],
    t: [["Meta, Agents Rule of Two", "https://ai.meta.com/blog/practical-ai-agent-security/"], ["Design patterns against prompt injection", "https://arxiv.org/abs/2506.08837"], ["OWASP Top 10 for Agentic Applications", "https://genai.owasp.org/download/52117/?tmstv=1765059207"]],
    r: [["A terraform destroy post-mortem", "https://aishippingblog.com/p/how-i-dropped-our-production-database"], ["Railway: undoable deletes", "https://railway.com/changelog/2026-05-01-undoable-deletes"], ["Railway, an AI agent and a deleted volume", "https://blog.railway.com/p/your-ai-wants-to-nuke-your-database"]],
    g: [["GitHub coding agent risks", "https://docs.github.com/en/copilot/concepts/agents/coding-agent/risks-and-mitigations"], ["Anthropic, how we contain Claude", "https://www.anthropic.com/engineering/how-we-contain-claude"], ["Claude Code permission modes", "https://code.claude.com/docs/en/permission-modes"], ["AWS API MCP Server deny-list bypass", "https://aws.amazon.com/security/security-bulletins/2026-176-aws/"]]
  };
  function leverPhrase(f, v) {
    switch (f) {
      case "a": return v === "none" ? "it read nothing you didn't write" : v === "incidental" ? "it read only docs, libraries and search results" : "strangers could aim content at it";
      case "others": return v ? "it ran code you didn't write" : "it ran only code you wrote";
      case "exec": return v ? "it could run code" : "it could not run code at all";
      case "priv": return v ? "it could read private data" : "it could not read private data";
      case "keys": return "its strongest keys were " + KEY_NAMES[v];
      case "act": return v ? "it could act or send" : "it could not change things or send data";
      case "watch": return v === "every" ? "you read every action" : v === "auto" ? "you auto-approved" : "it ran alone";
      case "users": return v === "me" ? "only one person used each running copy" : v === "staff" ? "only colleagues shared it" : "the public used it";
      case "access": return v === "own" ? "it acted with each user's own access" : "it used one shared account";
    }
    return "";
  }

   
  var POLICY = {
    m: ["Engineers may run this agent without a sandbox only while reading every action it takes.", "The agent runs with its OS sandbox switched on, and cannot read secret files.", "The agent runs inside a container or VM, never directly on a laptop that holds company logins.", "Each session runs in its own microVM or gVisor sandbox."],
    k: ["The agent is given no credentials.", "The agent gets only read-only or single-project access, and cannot read anyone's personal logins.", "Credentials are short-lived and brokered from outside the agent's environment; no long-lived secrets sit inside it.", "The agent gets plan-only access; changes reach production through a reviewed pipeline or a person. Exploratory cloud work happens in a separate account or project with a permission ceiling."],
    e: ["No outbound restriction is needed.", "Outbound traffic is logged.", "Outbound traffic is limited to an approved list of hosts, enforced outside the agent, with no other route out.", "Outbound traffic is off or tightly limited, enforced outside the agent with no other route out, and no single agent both reads outside content and holds confidential data with the ability to send."],
    t: ["No tool restrictions apply.", "Destructive commands (deletes, force pushes, deploys) are denied.", "The agent plans; a person or a pipeline applies changes.", "Reading outside content and taking actions are split between separate agents or steps."],
    r: ["No extra recovery step is needed.", "Its actions are logged, and someone reviews the log.", "Backups and deletion protection sit where the agent cannot reach them, and revoking its access is tested."],
    g: ["No approval step is needed beyond normal review.", "Deletes, pushes and sends need a person's confirmation.", "Changes reach production, customers or money only through a step the agent cannot perform itself: a merge, a send or a payment approval."]
  };
  function policyFor(id, s, d) {
    if (id === "m" && !s.exec) return "It runs no code on our side, so no sandbox is needed; the other settings carry the load.";
    if (id === "k" && d.sharedReach && s.keys < 3) return "The assistant acts with each user's own access, not one shared account.";
    if (id === "e" && !d.C && d.e >= 2) return "Network access is off by default.";
    if (id === "e" && d.multi) return POLICY.e[d.e] + " Replies do not load images or links automatically.";
    return POLICY[id][d[id]];
  }
  function riskSummary(s, d) {
    var corners = [d.A ? "reads content strangers can aim at it" : null, d.B ? "can reach confidential data or real credentials" : null, d.C ? "can act or send data out" : null].filter(Boolean);
    var n = corners.length;
    var sup = s.watch === "every" ? "A person reads each action." : s.watch === "auto" ? "People approve its actions, usually without reading closely." : "It runs unattended.";
    var rl = L.riskLevel(s), rr = controlsAnswered(s) ? L.residualRisk(s) : rl;
    var unchecked = rr !== rl ? " That counts only isolation, the approval step and outbound limits, not access, tools or recovery, which the team default below still asks for." : "";
    var level = (rr !== rl ? "Before controls it is " + rl + " risk; with the isolation, approval step and outbound limits already in place it is " + rr + "." + unchecked + " " : "")
      + (rr === "high" ? "Treat it as high risk until the team default below is in place."
      : rr === "moderate" ? "Moderate risk. The team default below reduces it; nothing removes it, because prompt injection has no complete fix."
      : "Lower risk on these answers. Check again if what it reads, holds or can do changes.");
    var who = s.users === "staff" ? " It serves staff" + (s.access === "shared" ? " through one shared account." : ", each with their own access.")
      : s.users === "public" ? " It serves customers or the public" + (s.access === "shared" ? " through one shared account." : ", each with their own access.") : "";
    var why = [];
    if (d.multi && s.exec) why.push("code that others send runs where they all share it");
    if (s.keys === 3) why.push("its keys can reach admin, production or money");
    if (s.watch === "alone" && s.keys >= 2) why.push("it runs unattended with keys that can change things");
    var reason = (rl === "high" && n < 3 && why.length) ? " It is rated high because " + joinList(why) + "." : "";
    return "This agent has " + n + " of the three risk corners" + (n ? ": it " + joinList(corners) : "") + ". Its strongest access is " + KEY_NAMES[s.keys] + "." + who + " " + sup + reason + " " + level;
  }
  function engineerQuestions(s, d) {
    var q = ["Which secrets and logins can the account it runs under read today?"];
    if (s.a !== "none") q.push("Which outside sources does it read, and could any be removed?");
    if (s.others) q.push("Which third-party plug-ins or servers does it use, and are their versions pinned and reviewed?");
    if (d.r === 2) q.push("If it deleted something important, how would we restore it, and has that been tested?");
    if (s.keys >= 2) q.push("Can its credentials be replaced with limited, short-lived ones held outside its environment?");
    if (s.act) q.push("What is the worst single action it could take, and can that be undone?");
    if (s.watch !== "every") q.push("Who sees what it did, and how soon?");
    if (d.sharedReach) q.push("Does it act with each user's own access, or one account for everyone?");
    if (s.exec && s.today < d.m) q.push("What would it take to run it in the isolation the team default asks for?");
    return q;
  }
  function vendorQuestions(s) {
    var q = ["Does the agent run in a sandbox by default, and what can it read inside it?", "Where do our credentials live: inside the agent's environment, or outside it?", "Which hosts can it contact, and can we restrict them?", "Can we require approval for deletes, sends and payments?", "What log of its actions do we get, and for how long?"];
    if (s.users !== "me") q.push("How is each user's session and data kept apart from the others?", "Do replies load images or links automatically, and can we turn that off?");
    if (s.exec) q.push("Which code executor or sandbox does it use, and what runs outside it?");
    return q;
  }

   
  function sbAdvice(sb, s, d) {
    var dos = [], donts = [];
    var unsure = L.SB_FIELDS.filter(function (f) { return sb[f] === "unsure"; });
    if (sb.signin === "unsure") dos.push("Find out which accounts it is signed into. Until you know, assume it can do anything those accounts can.");
    if (s.keys >= 3) donts.push("Connect it with an admin login or the business's main accounts.");
    if (s.keys >= 1) dos.push("Give it the least access that does the job, and check the apps connected to your accounts every three months.");
    if (d.r === 2) dos.push("Keep backups of anything it can change or delete, somewhere it cannot reach.");
    if (d.g === 2) dos.push("Keep a person approving anything that sends money, emails customers or deletes records, as a step the tool cannot do itself.");
    else if (d.g === 1) dos.push("Check deletes and sends before they happen.");
    if (s.watch === "auto") donts.push("Click approve without reading what it is about to do.");
    if (d.A && d.B && d.C && s.watch !== "every") donts.push("Let one AI tool both read outside messages and act on private information without a person checking.");
    if (d.A && d.B && d.C && s.a === "aimed" && !s.exec) dos.push("Stop it reading outside content it was not asked about, such as calendar invites from strangers or documents shared from outside.");
    if (d.A && s.priv) dos.push("Treat emails, documents and web pages it reads as possibly containing hidden instructions.");
    if (d.e >= 2) dos.push(sb.where === "vendor" ? "Ask the supplier which services it connects to, and whether you can limit them." : "Ask your IT provider to limit which websites and services the tool can connect to.");
    if (sb.where === "vendor") dos.push("Ask the supplier how your data is kept apart from other customers' and how its access to your accounts is limited.");
    else if (d.m === 3) dos.push("Ask your IT provider to run it in a separate environment for each customer or user session, not a sandbox on a shared computer, and away from your main accounts.");
    else if (d.m >= 1) dos.push("Ask your IT provider to run it in a sandbox or a separate environment, away from your main accounts.");
    if (s.users === "public") dos.push("Check what it can reveal: anyone on the internet can ask it questions.");
    else if (s.users === "staff") dos.push("Give it only the access every staff member should have, or have it use each person's own access.");
    if (s.others) dos.push("Keep a list of the add-ons and connectors it has, and remove the ones you don't use.");
    if (unsure.length) dos.push("Go through the Not sure answers with your IT provider. Until then, this advice assumes the worst.");
    if (!dos.length) dos.push("Keep it as it is, and check these answers again when the tool or its access changes.");
    return { dos: dos, donts: donts };
  }
  function staffRule(sb, s, d) {
    var lines = ["AI tools at work: our rule", ""];
    var n = 1;
    if (s.keys >= 1) lines.push((n++) + ". Give AI tools the least access that does the job, and never an admin login.");
    if (d.g >= 1) lines.push((n++) + ". A person approves anything that sends money, emails customers or deletes records.");
    if (s.watch !== "alone") lines.push((n++) + ". Read what the tool is about to do before you approve it.");
    lines.push((n++) + ". Don't paste passwords, card numbers or customer records into an AI tool unless it is approved for that.");
    if (s.a !== "none") lines.push((n++) + ". Be suspicious of instructions that appear inside emails or documents the tool reads.");
    lines.push((n++) + ". If the tool does something unexpected, stop using it and tell the person who looks after IT.");
    lines.push("", "Made with the Agent Isolation Map, " + RULES + ".");
    return lines.join("\n");
  }
  var IT_QUESTIONS = ["Which accounts is the tool signed into, and what can each one do?", "Can it have its own account with less access?", "Does it run in a sandbox or a separate environment?", "Which websites and services can it connect to?", "Can we see a log of what it did?", "If it deletes or sends something by mistake, can we undo it?"];

   
  var started = false, sent = false, resultTimer = null;
  function used() {
    if (!started) { started = true; T.track("tool_start", { tool: "agent_isolation" }); }
    if (sent) return;
    if (resultTimer) clearTimeout(resultTimer);
    resultTimer = setTimeout(function () { sent = true; T.track("tool_result", { tool: "agent_isolation", verdict: L.riskLevel(current()) }); }, 1500);
  }

   
  var view = "eng";
  

  var IN_PLACE = ["gateNow", "egressNow"];
  function controlsAnswered(s) { return s.today > 0 || s.gateNow > 0 || s.egressNow > 0; }
  var state = Object.assign({}, L.PRESETS[0]);
  var sb = Object.assign({}, L.SB_PRESET);

  function current() { return view === "sb" ? L.fromSmallBusiness(sb) : state; }
  function matchPreset(s) {
    for (var i = 0; i < L.PRESETS.length; i++) {
      var p = L.PRESETS[i], same = true;
      for (var j = 0; j < L.FIELDS.length; j++) { if (p[L.FIELDS[j]] !== s[L.FIELDS[j]]) { same = false; break; } }
      if (same) return p;
    }
    return null;
  }
  function el(tag, attrs, text) {
    var a = Object.assign({}, attrs || {});
    if (text != null) a.text = String(text);
    return T.el(tag, a);
  }
  function list(tag, items) { var u = el(tag); items.forEach(function (t) { u.appendChild(el("li", null, t)); }); return u; }

   
  function questionsFor(v) { return v === "sb" ? SB_Q : v === "lead" ? LEAD_Q : ENG_Q; }
  function answers() { return view === "sb" ? sb : state; }

  function buildControls() {
    var box = document.getElementById("presets");
    box.textContent = "";
    document.getElementById("sb-example").hidden = view !== "sb";
    if (view !== "sb") {
      L.PRESETS.forEach(function (p) {
        var b = el("button", { type: "button", class: "aim-chip", "data-id": p.id, "aria-pressed": "false" }, p.name);
        b.addEventListener("click", function () { state = Object.assign({}, p); syncInputs(); render(); used(); });
        box.appendChild(b);
      });
    }
    var qbox = document.getElementById("questions");
    var cbox = document.getElementById("controls-q");
    qbox.textContent = "";
    cbox.textContent = "";
    questionsFor(view).forEach(function (q) {
      var inPlace = IN_PLACE.indexOf(q.key) !== -1;
      var box = inPlace ? cbox : qbox;
      if (q.group) box.appendChild(el("p", { class: "aim-group-label" }, q.group));
      var fs = el("fieldset");
      if (q.key === "access") fs.id = "fs-access";
      fs.appendChild(el("legend", null, q.label));
      fs.appendChild(el("p", { class: "t-hint" }, q.hint));
      var seg = el("div", { class: "aim-seg" });
      q.opts.forEach(function (o, i) {
        var id = "q-" + view + "-" + q.key + "-" + i;
        var input = el("input", { type: "radio", name: "q-" + view + "-" + q.key, id: id, value: String(o[0]) });
        input.addEventListener("change", function () {
          answers()[q.key] = o[0];
           
          if (view !== "sb" && q.key === "users" && o[0] === "me" && state.access !== "own") { state.access = "own"; syncInputs(); }
          render();
          used();
        });
        seg.appendChild(input);
        seg.appendChild(el("label", { for: id }, o[1]));
      });
      fs.appendChild(seg);
      box.appendChild(fs);
    });
    syncInputs();
  }
  function syncInputs() {
    var a = answers();
    questionsFor(view).forEach(function (q) {
      q.opts.forEach(function (o, i) { document.getElementById("q-" + view + "-" + q.key + "-" + i).checked = a[q.key] === o[0]; });
    });
  }

  function setView(v) {
    view = v;
    Array.prototype.forEach.call(document.querySelectorAll(".aim-views button"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-view") === v ? "true" : "false"); });
    var total = v === "sb" ? 2 : 4;
    ["tri-h", "path-h", "grid-h", "heat-h"].forEach(function (h, i) { document.getElementById("step-" + h).textContent = "Step " + (i + 1) + " of " + total; });
    var T = VIEW_TEXT[v];
    document.getElementById("lede").textContent = T.lede;
    document.getElementById("view-note").textContent = T.note;
    document.getElementById("settings-h").textContent = T.answer;
    document.getElementById("copy").textContent = T.copy;
    document.getElementById("presets-label").textContent = T.presets;
    Array.prototype.forEach.call(document.querySelectorAll('[data-hide="sb"]'), function (n) { n.hidden = v === "sb"; });
    document.getElementById("copy-fallback").hidden = true;
    document.getElementById("copy-status").textContent = "";
    buildControls();
    render();
  }
  Array.prototype.forEach.call(document.querySelectorAll(".aim-views button"), function (b) {
    b.addEventListener("click", function () { setView(b.getAttribute("data-view")); used(); });
  });
  document.getElementById("it-switch").addEventListener("click", function () {
    state = L.fromSmallBusiness(sb);
    setView("eng");
    used();
    document.getElementById("answer-h").focus();
  });

   
   
  function meter(level, max) {
    var m = el("div", { class: "aim-meter", role: "img", "aria-label": "Level " + level + " of " + max });
    for (var i = 1; i <= max; i++) m.appendChild(el("span", { class: i <= level ? "aim-on" : "" }));
    return m;
  }
  var MEANS = {
    m: "Where it runs, and the walls around it.",
    k: "The credentials and logins within its reach.",
    e: "Which hosts it can connect to.",
    t: "Which commands and tools it may use.",
    g: "A step a person takes before it acts.",
    r: "How you see what it did, and undo it."
  };
   
  var NAMES = {
    eng: { m: "Sandbox", k: "Keys", e: "Outbound traffic", t: "Toolset", g: "Human gate", r: "Recovery and logs" },
    lead: { m: "Isolation", k: "Access", e: "Outbound traffic", t: "Tools", g: "Approval step", r: "Recovery and logs" }
  };
  function settingRows(s, d) {
    var N = NAMES[view === "lead" ? "lead" : "eng"];
    return [
      { id: "m", name: N.m, label: boxLabel(s, d), level: d.m, max: 3, why: boxWhy(s, d) },
      { id: "k", name: N.k, label: keysLabel(s, d.k), level: d.k, max: 3, why: keysWhy(s, d) },
      { id: "e", name: N.e, label: egressLabel(s, d), level: d.e, max: 3, why: egressWhy(s, d) },
      { id: "t", name: N.t, label: TOOLSET[d.t], level: d.t, max: 3, why: toolsetWhy(s, d) },
      { id: "g", name: N.g, label: GATE[d.g], level: d.g, max: 2, why: gateWhy(s, d) },
      { id: "r", name: N.r, label: RECOVER[d.r], level: d.r, max: 2, why: recoverWhy(s, d) }
    ];
  }
  function leverText(s, row) {
    var lv = L.levers(s, row.id);
    if (!lv.length) return null;
    var seen = {}, parts = [];
    for (var i = 0; i < lv.length && parts.length < 2; i++) {
      if (seen[lv[i].field]) continue;
      seen[lv[i].field] = true;
      parts.push(leverPhrase(lv[i].field, lv[i].value));
    }
    return "This could be lower if " + parts.join(", or if ") + ".";
  }
  function residualLine(s) {
    var what = view === "lead" ? "the isolation, approval step and outbound limits" : "the sandbox, gate and outbound control";
    return "With " + what + " already in place: " + L.residualRisk(s) + " risk (keys, toolset and recovery are not counted in this figure).";
  }
  var LEVEL_HEAD = { lower: "Lower risk", moderate: "Moderate risk", high: "High risk" };
  

  function afterAdvice(s, d) { return L.residualRisk(Object.assign({}, s, { today: d.m, gateNow: d.g, egressNow: d.e })); }
  function afterLine(s, d) {
    return view === "lead"
      ? "With the isolation, approval step and outbound limits below in place: " + afterAdvice(s, d) + " risk. Access, tools and recovery are not counted in that figure."
      : "With the sandbox, gate and outbound settings below in place: " + afterAdvice(s, d) + " risk. Keys, toolset and recovery are not counted in that figure.";
  }
  function renderVerdict(s, d) {
    var card = document.getElementById("aim-answer"), h = document.getElementById("answer-h");
    var why = document.getElementById("verdict-why"), after = document.getElementById("verdict-after");
    var lvl = L.riskLevel(s);
    card.classList.toggle("is-high", lvl === "high");
    document.getElementById("aim-bar").classList.toggle("is-high", lvl === "high");
    document.getElementById("aim-bar-text").textContent = view === "sb" ? LEVEL_HEAD[lvl] : LEVEL_HEAD[lvl] + " before controls";
    document.getElementById("settings-h").hidden = view === "sb";
    document.getElementById("controls-link").hidden = view === "sb";
    why.hidden = view === "lead";
    after.hidden = view === "sb";
    if (view === "sb") {
      var signs = [d.A ? "reads things from outside the business" : null, d.B ? "sees private information or important accounts" : null, d.C ? "can act on your behalf" : null].filter(Boolean);
      var unsure = L.SB_FIELDS.some(function (f) { return sb[f] === "unsure"; });
      h.textContent = LEVEL_HEAD[lvl];
      why.textContent = (signs.length ? "It " + joinList(signs) + "." : "None of the three warning signs applies.") + (unsure ? " Some answers are Not sure, so this assumes the worst." : "");
      return;
    }
    h.textContent = LEVEL_HEAD[lvl] + " before controls";
    var corners = [d.A ? "reads content strangers can aim at it" : null, d.B ? "can reach private data or real keys" : null, d.C ? "can act or send data out" : null].filter(Boolean);
    why.textContent = "It has " + corners.length + " of the three risk corners" + (corners.length ? ": it " + joinList(corners) : "") + ".";
    after.textContent = afterLine(s, d);
  }
  function renderResidual(s) {
    var p = document.getElementById("residual");
    p.textContent = view === "sb" ? "" : controlsAnswered(s) ? residualLine(s)
      : "Unanswered, nothing counts as in place. Answer these and the risk that remains shows here.";
  }
  var openWhy = {};
  function renderDials(s, d) {
    var box = document.getElementById("dials");
    box.textContent = "";
    box.hidden = view === "sb";
    if (view === "sb") return;
    settingRows(s, d).forEach(function (r) {
      var dial = el("div", { class: "aim-dial" });
      var top = el("div", { class: "aim-dial-top" });
      top.appendChild(el("h3", null, r.name));
      top.appendChild(meter(r.level, r.max));
      dial.appendChild(top);
      dial.appendChild(el("p", { class: "aim-dial-def" }, MEANS[r.id]));
      dial.appendChild(el("p", { class: "aim-dial-level" }, view === "lead" ? policyFor(r.id, s, d) : r.label));
      if (r.id === "t" && d.t === 3) {
        var cs = concreteSteps(s, d);
        if (cs.length) { dial.appendChild(el("p", { class: "aim-dial-why" }, "Concrete steps:")); dial.appendChild(list("ul", cs)); }
      }
      var fold = el("details", { class: "aim-why" });
      fold.appendChild(el("summary", null, view === "eng" ? "Why, and sources" : "Sources"));
      if (view === "eng") {
        fold.appendChild(el("p", { class: "aim-dial-why" }, r.why));
        var lt = leverText(s, r);
        if (lt) fold.appendChild(el("p", { class: "aim-dial-lever" }, lt));
      }
      var src = el("p", { class: "aim-dial-src" });
      src.appendChild(document.createTextNode("Based on: "));
      SOURCES[r.id].forEach(function (x, i) { if (i) src.appendChild(document.createTextNode("; ")); src.appendChild(el("a", { href: x[1] }, x[0])); });
      fold.appendChild(src);
       
      fold.open = !!openWhy[view + r.id];
      fold.addEventListener("toggle", function () { openWhy[view + r.id] = fold.open; });
      dial.appendChild(fold);
      box.appendChild(dial);
    });
  }
  function renderLead(s, d) {
    var box = document.getElementById("out-lead");
    box.hidden = view !== "lead";
    box.textContent = "";
    document.getElementById("out-lead-after").hidden = true;
    if (view !== "lead") return;
    box.appendChild(el("p", { class: "aim-summary-line" }, riskSummary(s, d)));
     
    var after = document.getElementById("out-lead-after");
    after.hidden = false;
    after.textContent = "";
    var two = el("div", { class: "aim-dodont" });
    var a = el("div", { class: "aim-out-block" }); a.appendChild(el("h3", null, "Questions for your engineers")); a.appendChild(list("ul", engineerQuestions(s, d)));
    var b = el("div", { class: "aim-out-block" }); b.appendChild(el("h3", null, "Questions for vendors")); b.appendChild(list("ul", vendorQuestions(s)));
    two.appendChild(a); two.appendChild(b);
    after.appendChild(two);
  }
  function renderSb(s, d) {
    var box = document.getElementById("out-sb");
    box.hidden = view !== "sb";
    document.getElementById("it-switch-wrap").hidden = view !== "sb";
    box.textContent = "";
    if (view !== "sb") return;
    var adv = sbAdvice(sb, s, d);
    box.appendChild(el("h3", null, VIEW_TEXT.sb.answer));
    var two = el("div", { class: "aim-dodont" });
    var a = el("div", { class: "aim-out-block" }); a.appendChild(el("h3", { class: "aim-do" }, "Do")); a.appendChild(list("ul", adv.dos));
    two.appendChild(a);
    var b = el("div", { class: "aim-out-block" }); b.appendChild(el("h3", { class: "aim-dont" }, "Don't"));
    b.appendChild(adv.donts.length ? list("ul", adv.donts) : el("p", { class: "aim-note" }, "Nothing to avoid beyond the usual care."));
    two.appendChild(b);
    box.appendChild(two);
    box.appendChild(el("h3", null, "A rule for your staff"));
    box.appendChild(el("pre", { class: "aim-rule-text" }, staffRule(sb, s, d)));
    box.appendChild(el("h3", null, "Questions for your IT provider or the tool's supplier"));
    box.appendChild(list("ol", IT_QUESTIONS));
    if (sb.users === "public") box.appendChild(el("p", { class: "aim-note" }, "What it tells customers, such as a wrong price or promise, is a content and liability question outside this map. Take advice on it separately."));
  }

   
  var CORNERS = {
    eng: ["Reads content a stranger can aim at it", "Private data or real keys in reach", "Can act or send data out"],
    lead: ["Reads content strangers can aim at it", "Confidential data or real credentials in reach", "Can act or send data out"],
    sb: ["Reads things from outside the business", "Sees private information or important accounts", "Can act on your behalf"]
  };
  function renderTriangle(s, d) {
    var lit = { a: d.A, b: d.B, c: d.C };
    ["a", "b", "c"].forEach(function (k) { document.getElementById("n-" + k).setAttribute("class", "aim-tri-node" + (lit[k] ? " aim-lit" : "")); });
    document.getElementById("e-ab").setAttribute("class", "aim-tri-edge" + (lit.a && lit.b ? " aim-lit" : ""));
    document.getElementById("e-ac").setAttribute("class", "aim-tri-edge" + (lit.a && lit.c ? " aim-lit" : ""));
    document.getElementById("e-bc").setAttribute("class", "aim-tri-edge" + (lit.b && lit.c ? " aim-lit" : ""));
    var names = CORNERS[view];
    var items = [["A", names[0], lit.a], ["B", names[1], lit.b], ["C", names[2], lit.c]];
    var ul = document.getElementById("corners");
    ul.textContent = "";
    items.forEach(function (it) {
      var li = el("li");
      li.appendChild(el("span", { class: "aim-badge" + (it[2] ? " aim-lit" : "") }, it[0]));
      var t = el("span"); t.appendChild(el("strong", null, it[1])); t.appendChild(document.createTextNode(it[2] ? ": yes" : ": no"));
      li.appendChild(t); ul.appendChild(li);
    });
    var n = (lit.a ? 1 : 0) + (lit.b ? 1 : 0) + (lit.c ? 1 : 0);
    var V = view === "sb"
      ? ["None of the three. Check the advice above as well.", "One of the three. Check the advice above as well.", "Two of three. Keep the third away.", "All three. Take one away, or have a person check before it acts."]
      : ["No corners. The triangle is not the whole picture: other answers can still raise the settings above.", "One corner. The triangle is not the whole picture: other answers can still raise the settings above.", "Two corners: the most one session should hold without a person checking, in Meta's guidance. Keep the third out.", "All three corners. Remove one, or put a person at a gate the agent cannot bypass."];
    document.getElementById("tri-verdict").textContent = V[n];
  }
  var LAYER_TEXT = {
    tech: {
      "in": { name: "Gets in", what: "Untrusted input steers the agent", ctrl: "Fewer tools; only trusted people can start a run", inc: "Clinejection, Comment and Control" },
      "run": { name: "Runs", what: "It runs code on a machine", ctrl: "A sandbox that matches the setting above", inc: "s1ngularity, Check Point project-file CVEs" },
      "reach": { name: "Reaches", what: "It finds keys and data", ctrl: "Scoped, brokered keys; a separate account; reads limited to what the job needs", inc: "PocketOS, Replit, terraform destroy" },
      "out": { name: "Gets out", what: "It deletes, leaks or spends", ctrl: "A gate it cannot bypass and outbound limits that meet the settings above; replies that cannot load images or links on their own", inc: "EchoLeak, GitHub MCP, CamoLeak" }
    },
    sb: {
      "in": { name: "Gets in", what: "Hidden instructions in something it reads", ctrl: "Fewer outside sources" },
      "run": { name: "Runs", what: "It runs programs on a computer", ctrl: "A sandbox or separate environment" },
      "reach": { name: "Reaches", what: "It uses the accounts it is signed into", ctrl: "Its own account with less access" },
      "out": { name: "Gets out", what: "It sends, deletes or pays", ctrl: "A person checks first" }
    }
  };
  function renderPath(s) {
    var box = document.getElementById("path");
    box.textContent = "";
    var ls = L.layers(s), holes = 0, TT = LAYER_TEXT[view === "sb" ? "sb" : "tech"];
    ls.forEach(function (layer, i) {
      var T = TT[layer.id];
      var supplier = view === "sb" && sb.where === "vendor" && layer.id === "run";
      if (layer.hole) holes++;
      var c = el("div", { class: "aim-layer" + (layer.hole ? " aim-hole" : "") });
      c.appendChild(el("h3", null, T.name));
      c.appendChild(el("span", { class: "aim-pill " + (supplier ? "aim-ask" : layer.hole ? "aim-hole" : "aim-shut") }, supplier ? "Ask the supplier" : layer.hole ? "Hole" : "Looks closed"));
      c.appendChild(el("p", { class: "aim-what" }, supplier ? "It runs on the supplier's servers" : T.what));
      c.appendChild(el("p", { class: "aim-ctrl" }, supplier ? "Closed by: the supplier's own isolation. Ask how it works" : "Closed by: " + T.ctrl));
      if (T.inc) c.appendChild(el("p", { class: "aim-inc" }, "Seen in: " + T.inc));
      box.appendChild(c);
      if (i < ls.length - 1) box.appendChild(el("span", { class: "aim-arrow", "aria-hidden": "true" }, "\u2192"));
    });
    document.getElementById("path-summary").textContent = holes === 4 ? "All four layers are open. Each one you close makes an attack much harder; in our reading, keys are often the cheapest to change."
      : holes === 3 ? "Three of four layers are open. Each one you close makes an attack harder, and the sandbox is often not the cheapest one to close."
      : holes + " of 4 layers open.";
  }
  var ROWS = ["None", "OS sandbox", "Container / VM", "microVM / gVisor"];
  var COLS = ["No keys", "Read-only or one project", "Change or delete your work", "Admin, production, money"];
   
  var GRID_WORD = { low: "lower", medium: "moderate", high: "high" };
  function renderGrid(s) {
    var t = document.getElementById("grid");
    t.textContent = "";
    var head = el("tr");
    head.appendChild(el("th", null, "Sandbox \u2193 / Keys \u2192"));
    COLS.forEach(function (c) { head.appendChild(el("th", { class: "aim-col", scope: "col" }, c)); });
    t.appendChild(head);
    var gr = L.grid(s);
    ROWS.forEach(function (rname, r) {
      var tr = el("tr");
      tr.appendChild(el("th", { scope: "row" }, rname));
      COLS.forEach(function (_, c) {
        var lvl = L.risk(r, c);
        var isStart = r === gr.start.row && c === gr.start.col, isAdv = r === gr.advised.row && c === gr.advised.col;
        var td = el("td", { class: "aim-r-" + lvl + (isStart ? " aim-start" : "") + (isAdv ? " aim-advised" : "") });
        td.appendChild(document.createTextNode(GRID_WORD[lvl] + (r === 1 && c === 2 ? "*" : "")));
        if (isStart) td.appendChild(el("span", { class: "aim-tag" }, "today"));
        if (isAdv) td.appendChild(el("span", { class: "aim-tag" }, "advised"));
        tr.appendChild(td);
      });
      t.appendChild(tr);
    });
  }
  function dots(level, max) { var x = ""; for (var i = 1; i <= max; i++) x += i <= level ? "\u25CF" : "\u25CB"; return x; }
  var SHORT = { t: ["full", "deny risky", "plan only", "split"], g: ["none", "confirm", "hard gate"], r: ["none", "log", "backups"] };
  function renderHeat(s) {
    var t = document.getElementById("heat");
    t.textContent = "";
    var head = el("tr");
    var HEADS = ["Agent type", "Sandbox", "Keys", "Outbound", "Toolset", "Human gate", "Recovery"];
    HEADS.forEach(function (h) { head.appendChild(el("th", { scope: "col" }, h)); });
    t.appendChild(head);
    var cur = matchPreset(s);
    L.PRESETS.forEach(function (p) {
      var d = L.compute(p);
      var tr = el("tr", { class: cur && cur.id === p.id ? "aim-current" : "" });
      var td0 = el("td", { "data-label": HEADS[0] });
      var b = el("button", { type: "button" }, p.name);
       
      b.addEventListener("click", function () { state = Object.assign({}, p); syncInputs(); render(); used(); document.getElementById("answer-h").focus(); });
      td0.appendChild(b); tr.appendChild(td0);
      [[d.m, 3, BOX_SHORT[d.m]], [d.k, 3, keysText(p, d.k)[1]], [d.e, 3, egressText(p, d)[1]], [d.t, 3, SHORT.t[d.t]], [d.g, 2, SHORT.g[d.g]], [d.r, 2, SHORT.r[d.r]]].forEach(function (c, ci) {
        var td = el("td", { "data-label": HEADS[ci + 1] });
        td.appendChild(el("span", { class: "aim-dots", "aria-hidden": "true" }, dots(c[0], c[1])));
        td.appendChild(el("span", { class: "aim-lvl" }, c[2]));
        tr.appendChild(td);
      });
      t.appendChild(tr);
    });
  }

   
  

  var PAGE = "https://impacteng.com.au/tools/agent-isolation-map/";
  var RULES = "rules version " + L.VERSION + ", revision 6";
  function today() {
    var t = new Date(), two = function (n) { return (n < 10 ? "0" : "") + n; };
    return t.getFullYear() + "-" + two(t.getMonth() + 1) + "-" + two(t.getDate());
  }
  function answerLines() {
    var a = answers(), out = [];
    questionsFor(view).forEach(function (q) {
      if (q.key === "access" && view !== "sb" && state.users === "me") return;
      var o = q.opts.filter(function (x) { return x[0] === a[q.key]; })[0];
      if (o) out.push("- " + q.label.replace(/\?$/, "") + ": " + o[1]);
    });
    return out;
  }
  function copyText(s, d) {
    var lvl = L.riskLevel(s), foot = ["", "Made with the Agent Isolation Map (" + RULES + ") on " + today() + ". A synthesis of public sources read in November 2026; not a published standard.", PAGE];
    if (view === "sb") {
      var adv = sbAdvice(sb, s, d);
      var sbLines = ["What to do about this AI tool", "", "Answers:"].concat(answerLines(), ["", LEVEL_HEAD[lvl] + ". " + document.getElementById("verdict-why").textContent, "", "Do:"],
        adv.dos.map(function (x) { return "- " + x; }), adv.donts.length ? ["", "Don't:"].concat(adv.donts.map(function (x) { return "- " + x; })) : [],
        ["", staffRule(sb, s, d), "", "Questions for your IT provider or the tool's supplier:"], IT_QUESTIONS.map(function (x, i) { return (i + 1) + ". " + x; }), foot);
      return sbLines.join("\n");
    }
    var p = matchPreset(s);
    var lines = [view === "lead" ? "Team default for an AI agent" : "Agent Isolation Map checklist", "Agent: " + (p ? p.name : "your own answers") + ".", "", "Answers:"].concat(answerLines());
    lines.push("", LEVEL_HEAD[lvl] + " before controls. " + afterLine(s, d));
    if (controlsAnswered(s)) lines.push(residualLine(s));
    lines.push("", view === "lead" ? "Team default:" : "Settings:");
    settingRows(s, d).forEach(function (r) { lines.push((view === "lead" ? "- " : "[ ] ") + r.name + ": " + (view === "lead" ? policyFor(r.id, s, d) : r.label)); });
    return lines.concat(foot).join("\n");
  }
  document.getElementById("controls-link").addEventListener("click", function () { document.getElementById("fold-controls").open = true; });
  document.getElementById("copy").addEventListener("click", function () {
    var s = current();
    var text = copyText(s, L.compute(s));
    var status = document.getElementById("copy-status");
    var fb = document.getElementById("copy-fallback");
    function fallback() { fb.hidden = false; fb.value = text; fb.focus(); fb.select(); status.textContent = " Select all and copy."; }
    var settled = false;
    var timer = setTimeout(function () { if (!settled) { settled = true; fallback(); } }, 2000);
    try {
      navigator.clipboard.writeText(text).then(function () {
        if (settled) return; settled = true; clearTimeout(timer); fb.hidden = true; status.textContent = " Copied.";
      }, function () { if (settled) return; settled = true; clearTimeout(timer); fallback(); });
    } catch (err) { settled = true; clearTimeout(timer); fallback(); }
  });

   
  function render() {
    var s = current();
    var d = L.compute(s);
    var p = view === "sb" ? null : matchPreset(s);
    Array.prototype.forEach.call(document.querySelectorAll(".aim-chip"), function (b) { b.setAttribute("aria-pressed", p && b.getAttribute("data-id") === p.id ? "true" : "false"); });
    document.getElementById("answer-for").textContent = view === "sb" ? "The answer for your tool" : "The answer for: " + (p ? p.name : "your own answers");
    document.getElementById("copy-status").textContent = "";
    document.getElementById("copy-fallback").hidden = true;
    document.getElementById("scope-note").hidden = !(view !== "sb" && s.users === "public");
    var fsa = document.getElementById("fs-access");
    if (fsa) fsa.hidden = view !== "sb" && state.users === "me";
    renderVerdict(s, d);
    renderLead(s, d);
    renderSb(s, d);
    renderDials(s, d);
    renderResidual(s);
    renderTriangle(s, d);
    renderPath(s);
    if (view !== "sb") { renderGrid(s); renderHeat(s); }
  }

  

  var bar = document.getElementById("aim-bar"), onScreen = { q: false, a: false };
  if (typeof IntersectionObserver === "function") {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { onScreen[e.target.id === "aim-answer" ? "a" : "q"] = e.isIntersecting; });
      bar.hidden = !(onScreen.q && !onScreen.a);
    });
    io.observe(document.getElementById("aim-questions"));
    io.observe(document.getElementById("aim-answer"));
  }

  setView("eng");
})();
