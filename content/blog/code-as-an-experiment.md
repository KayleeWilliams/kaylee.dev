---
title: "Code as an experiment"
description: "Coding models make experiments cheap enough to answer questions that were previously too expensive to ask."
publishedAt: 2026-07-12
tags:
  - AI
  - engineering
  - experiments
draft: false
---
Coding models make code cheap enough to experiment with. The code does not need to ship. It just needs to answer the question.

At [AI Engineer Miami](https://www.ai.engineer/miami) and [React Miami](https://www.reactmiami.com/) in April, a conversation with [https://x.com/tannerlinsley](https://x.com/tannerlinsley) left me with a question: what if we used coding models to test new shapes for a product, not just clear its existing backlog?

For c15t v3, I wanted to know whether the manifest system I built for scripts in v2 could be used for data fetching. The hypothesis was that this would improve performance enough to justify the added complexity. I knew how to measure the result, but not whether the idea would work. Proving it by hand would have meant committing real time to an uncertain direction. That is usually where an experiment gets pushed behind work with a clearer payoff.

This time, I wrote down the hypothesis, the rough shape of the implementation, and how I would judge the result. I set an agent loop running, then spent the day cleaning my apartment.

The first benchmarks were promising enough to keep investigating. So I tried the same approach on other parts of c15t and on a few of my other projects. Some ideas worked. Others failed miserably.

The failures were useful. I had spent a few moments describing the idea, then reviewed the result when it was ready. While the model explored a dead end, I worked on something else. An experiment no longer needed to win a place on my roadmap before it could teach me anything.

[https://x.com/theo/status/2074094418798485814](https://x.com/theo/status/2074094418798485814)

I think we underuse coding models this way. A generated implementation can test an assumption, expose a constraint, or give an idea enough shape to evaluate properly.

[https://x.com/rauchg/status/2070923036988248248](https://x.com/rauchg/status/2070923036988248248)

More possible implementations do not create more time to evaluate them. Every branch still asks for attention. That is why I start with a question and a way to measure the answer. Otherwise, cheap code just creates more code to review.

Code is cheap. The hard part is asking a useful question and knowing what the answer proves.