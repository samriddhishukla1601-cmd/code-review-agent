// src/index.ts
import express, { Request, Response } from 'express';
import { Octokit } from '@octokit/rest';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Initialize GitHub client and Google Gemini client
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

app.post('/webhook', async (req: Request, res: Response) => {
    // Acknowledge receipt to GitHub immediately to prevent timeouts
    res.status(200).send('Webhook received');

    const event = req.headers['x-github-event'];
    const action = req.body.action;

    // Trigger only when a Pull Request is opened or updated
    if (event === 'pull_request' && (action === 'opened' || action === 'synchronize')) {
        const pr = req.body.pull_request;
        const repoName = req.body.repository.name;
        const ownerName = req.body.repository.owner.login;
        const prNumber = pr.number;

        try {
            console.log(`Processing PR #${prNumber} in ${ownerName}/${repoName}...`);

            // Fetch the raw Git Diff of the pull request
            const { data: diffData } = await octokit.rest.pulls.get({
                owner: ownerName,
                repo: repoName,
                pull_number: prNumber,
                mediaType: {
                    format: "diff",
                },
            });

            const codeDiff = diffData as unknown as string;

            console.log('Sending code diff to Gemini for review...');
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            
            const prompt = `
            You are a strict, expert senior software engineer. Review the following code diff.
            Focus strictly on:
            1. Potential bugs or runtime logic errors.
            2. Security vulnerabilities.
            3. Performance bottlenecks.
            Do not nitpick minor formatting or spacing. Format your response cleanly in Markdown.
            
            Here is the code diff:
            ${codeDiff}
            `;

            const result = await model.generateContent(prompt);
            const aiReview = result.response.text();

            // Post the AI's feedback as a review comment on the GitHub PR
            await octokit.rest.issues.createComment({
                owner: ownerName,
                repo: repoName,
                issue_number: prNumber,
                body: `🤖 **DevGuard Autonomous Code Review:**\n\n${aiReview}`,
            });

            console.log(`Successfully posted review to PR #${prNumber}`);

        } catch (error) {
            console.error('Error processing Pull Request:', error);
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Code Review Agent server listening on port ${PORT}`);
});