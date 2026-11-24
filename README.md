# AI News Hub

<p align="center">
  <img src="https://raw.githubusercontent.com/amir-dev-projects/ai-news-hub/main/public/af-logo.png" alt="Amir Fatemi logo" width="90" />
</p>

<p align="center">
  **A personal project by Amir Fatemi**
</p>

<p align="center">
  <a href="https://ai-news-hub-gilt.vercel.app/">Visit AI News Hub</a>
</p>

## Why I built this

I follow AI developments closely, but keeping up with new models, research, tools, business updates and training resources takes time.

I wanted one place where I could follow these developments without checking many websites every day.

I also wanted to go a step further. Reading AI news is useful, but understanding what it means for my work as a Program Manager or Product Manager is much more valuable.

That was the idea behind AI News Hub.

I built it as a personal project to learn more about application development, database design, automation and the practical use of AI models.

## What I built

AI News Hub collects AI news from RSS feeds, organizes articles into categories and presents them in a single dashboard.

The application currently includes:

- **News collection:** Collects articles from configured publishers, including OpenAI, Google DeepMind, Hugging Face, NVIDIA, Google Research, MIT Technology Review, TechCrunch and The Verge.
- **Article categorization:** Organizes news into AI Models, Research, Generative AI, Business, AI Tools and Open Source.
- **AI training directory:** Lists training providers and learning resources.
- **Saved articles:** Provides a place for users to keep articles they want to revisit.
- **Daily AI takeaways:** Uses an AI model to review recent articles and identify useful learning opportunities for Program Managers and Product Managers.
- **Editorial review:** Allows me to review, edit, publish or discard AI-generated takeaways before they appear on the public dashboard.
- **Collection monitoring:** Records collection activity, including the number of feeds checked and new articles found.
- **News retention:** Uses a scheduled cleanup process to remove old articles while keeping bookmarked articles.

## How it works

I kept the system separated into a few parts.

### 1. Collecting news

The application uses RSS feeds rather than paid news-search services.

A scheduled GitHub Actions workflow calls a Next.js API endpoint every six hours. The collector reads the configured feeds, extracts article information and stores it in Supabase.

Articles are checked against their URLs to avoid inserting the same story more than once. Feed entries are sorted by publication date before the collection limit is applied.

### 2. Organizing articles

The application uses JavaScript rules and keyword matching to assign articles to categories.

For example, an article mentioning model releases, GPT or Gemini may be placed under AI Models. Articles about funding or acquisitions may be placed under Business.

This part does not depend on an AI model. I used regular application logic because the rules are clear enough to handle this task.

### 3. Generating daily takeaways

A separate scheduled workflow runs once a day.

The AI model reviews up to 40 recent articles from the previous 36 hours and considers earlier takeaways to avoid repeating the same topics.

It can generate up to three takeaways per day. It does not have to generate three. Sometimes no article offers a useful enough learning opportunity.

Each takeaway includes:

- A short title and management area.
- A summary explaining what a Program Manager or Product Manager can learn from the story.
- Why the topic matters.
- What knowledge or skill is worth developing.
- A practical example of how to apply the learning.
- Supporting articles and suggested resources.

The model returns structured JSON. The application checks the response and verifies that each takeaway is linked to at least one article from the collection.

New takeaways are saved as drafts. They are not published automatically.

### 4. Reviewing and publishing

I built a separate Admin review page.

From there, I can read the generated takeaways, check the supporting articles, edit the content, publish it or discard it.

Only published takeaways appear on the public dashboard.

This gives me control over the final content instead of relying entirely on the AI output.

## The technology behind it

| Area | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase / PostgreSQL |
| News collection | RSS Parser |
| AI generation | OpenAI Responses API |
| Scheduled tasks | GitHub Actions |
| Hosting | Vercel |
| Source control | GitHub |

I also used server-side API routes to handle database operations and protect private keys and application secrets.

## Challenges I worked through

Building the application was not just about writing code. A number of problems came up during development.

### Connecting the application to Supabase

One of the early challenges was database access and permissions.

The application could connect to Supabase, but some database operations failed because of table permissions and access rules. I had to understand the difference between public access and server-side access, and make sure privileged database operations stayed on the server.

### Working with different RSS feeds

Not every publisher provides information in exactly the same format.

I had to handle missing dates, article descriptions, links and other optional fields. I also added URL-based duplicate prevention so that running the collector several times would not create duplicate articles.

I learned that a successful RSS request does not always mean new articles are available.

### Getting structured AI responses

One issue came up when I started using the OpenAI Responses API.

I wanted the model to return JSON so the application could process the result. My first request did not work as expected because the input did not clearly ask the model to return a JSON object.

After changing the instructions, the response worked with the expected structure.

That was a good reminder that an API request can be technically valid but still not provide the result the application needs.

### Separating AI generation from publishing

At first, generating useful takeaways seemed like the main task. I realized that generation and publishing should be separate steps.

The model can suggest useful ideas, but its output still needs to be reviewed. I added a dedicated review page and made sure that drafts stay private until I approve them.

### Managing scheduled tasks

The application depends on several tasks running at different times.

I used GitHub Actions to trigger collection, daily takeaway generation and old-news cleanup. I also had to work with UTC schedules and understand how they relate to Vancouver time, including daylight saving changes.

### Keeping the database under control

As the number of collected articles grows, storing everything forever is not useful.

I added a retention process that removes articles older than 90 days, while preserving bookmarked articles.

This helped me think about database maintenance as part of the application design, rather than something to worry about later.

## What I learned from this project

### General software and product lessons

**1. Start with the problem, not the technology.**

The goal was not to build an application using AI. The goal was to solve a real problem: following AI developments and understanding what they mean for my work.

**2. Break a large problem into smaller parts.**

News collection, categorization, AI generation, review and publishing are separate responsibilities. Keeping them separate made the application easier to understand, test and improve.

**3. Data quality matters.**

A dashboard can look correct while showing old or incomplete information. I learned to distinguish between the time a process ran and the actual date of the content it collected.

**4. Plan for failures.**

Scheduled jobs can fail, feeds can change, APIs can return unexpected responses and database operations can be rejected. Logging and error handling are important parts of the application.

**5. Security needs to be considered from the beginning.**

Private API keys and database credentials should never be exposed in frontend code. Server-side operations need proper authorization.

**6. Build for maintenance, not just the first release.**

Duplicate prevention, collection logs, database retention and an Admin review process are not just extra features. They help keep the application reliable as it grows.

### What I learned about AI

This project also helped me understand some important differences between traditional application logic and AI-based functionality.

**1. AI does not need to do everything.**

I used ordinary JavaScript rules for article categorization because the task is predictable. I used an AI model where interpretation and judgment are more useful, such as identifying lessons from several news stories.

Choosing the right tool for each task is important.

**2. Good instructions make a difference.**

The quality of the result depends partly on how clearly the task is explained to the model.

For example, asking the model to summarize AI news is not enough. I had to explain that the audience is experienced Program Managers and Product Managers, and that each takeaway must explain what they can actually learn from the story.

**3. AI output needs validation.**

I do not treat the model's response as automatically correct.

The application checks the output structure and verifies that the suggested takeaways refer to real articles in the database. Unsupported suggestions are rejected.

**4. Structured responses make integration easier.**

Instead of asking the model for free-form text and trying to interpret it later, I asked it to return a defined JSON structure.

This made it easier to validate the response and store the information in the database.

**5. Human review still matters.**

AI can help find connections and suggest useful ideas, but it does not know every detail of my work or the context in which a lesson will be used.

Keeping a human review step helps maintain quality and gives me control over what gets published.

**6. AI should produce something useful, not just something interesting.**

A news summary tells me what happened. A good takeaway explains why it matters, what I should learn and how I might use that knowledge.

That is the difference I wanted AI News Hub to make.

## What I would like to improve next

This is an ongoing project. Some areas I would like to develop further include:

- Adding more reliable news sources and improving source monitoring.
- Expanding the AI training section with courses, videos and learning paths.
- Improving search and filtering.
- Making the daily takeaways more useful through better role-specific analysis.
- Adding more insight into collection quality and application activity.

## Final thoughts

I built AI News Hub to solve a problem I had, but it became much more than a news dashboard.

It gave me practical experience working with a modern web stack, databases, APIs, automation, security and AI integration.

More importantly, it helped me understand where AI is useful, where traditional application logic is a better choice, and why model output needs structure, validation and human review.

I plan to keep improving it as I learn more.

---

**Built by Amir Fatemi**
