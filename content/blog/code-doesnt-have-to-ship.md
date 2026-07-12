---
title: "Code doesn't have to ship"
description: "Coding agents make more engineering questions cheap enough to test."
publishedAt: 2026-07-12
tags:
  - AI
  - engineering
  - experiments
draft: false
---
At [AI Engineer Miami](https://www.ai.engineer/miami) and [React Miami](https://www.reactmiami.com/) in April, a conversation with [https://x.com/tannerlinsley](https://x.com/tannerlinsley) left me with a question: what if we used coding models to test new shapes for a product, not just clear its existing backlog?

I had somewhere to test it. For c15t v3, I was working on the server-rendered path for consent experiences.

Client-side c15t has a straightforward request path:

```text
Client → c15t backend → Client
```

Server-side rendering lets c15t use the framework to prepare the geo- and locale-specific experience before the page reaches the browser. In Next.js, that path looked like this:

```text
Client → Next.js server → c15t backend → Next.js server → Client
```

This moved the work server-side, but the Next.js server still had to call the c15t backend before it could respond. That put the latency between those servers on the critical path.

I wanted to know whether the manifest system I built for scripts in v2 could also describe the data needed to render a consent experience. My hypothesis was that we could cache that manifest at the CDN edge, then let the Next.js server combine it with the request's geography and locale to produce the response itself:

```text
Client → Next.js server → Client
```

That would keep the benefits of server-side rendering while removing the trip to the c15t backend. The question was whether the performance improvement would justify moving more logic into the manifest system.

Proving it by hand would have meant giving an uncertain direction real roadmap time. That is usually where an experiment loses to work with a clearer payoff.

Instead, I wrote down the hypothesis, the rough implementation, and the benchmark that would decide whether it was worth pursuing. I set an agent loop running, then spent the day cleaning my apartment.

The experiment worked. With the manifest cached at the CDN edge, the Next.js server could produce the response without waiting for the c15t backend. The request was no longer exposed to the latency between those servers, and the improvement was large enough to keep investigating.

I started using the same approach elsewhere in c15t and across a few of my other projects. Some ideas worked. Others failed miserably.

The failures were useful. While a model explored a dead end, I worked on something else. I still had to inspect the implementation and decide what its result proved, but I did not have to build every branch myself.

Theo described the distinction neatly: code can be useful without being merged.

[https://x.com/theo/status/2074094418798485814](https://x.com/theo/status/2074094418798485814)

That is what makes this different from asking a coding agent to clear a backlog. The task is not “implement this feature.” It is “produce enough evidence to decide whether this idea deserves to become a feature.”

A prototype gives an idea shape. An experiment answers a question. Coding agents make both cheaper, but only the second starts with a hypothesis and a way to prove it wrong.

More possible implementations do not create more time to evaluate them. Every branch still asks for attention. Guillermo Rauch makes the other half of the argument: greater implementation capacity makes engineering judgment more important, not less.

[https://x.com/rauchg/status/2070923036988248248](https://x.com/rauchg/status/2070923036988248248)

That is why I start with a question and a way to measure the answer. Without both, cheap code just creates more code to review.

The code does not need to ship. It just needs to make the next decision clearer.
