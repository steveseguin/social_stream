# Commit Message Enhancer

A GitHub Action that automatically enhances your commit messages and pull request descriptions using Google's Gemini API.

## Setup Instructions

1. Create the following directory structure in your repository:
   ```
   .github/
     workflows/
       enhance-commits.yml
     scripts/
       enhance-commits.js
   ```

2. Copy the provided files into their respective locations.

3. Get a Gemini API key from Google AI Studio (https://makersuite.google.com/).

4. Add your Gemini API key as a repository secret:
   - Go to your repository on GitHub
   - Navigate to Settings > Secrets and variables > Actions
   - Click "New repository secret"
   - Name: `GEMINI_API_KEY`
   - Value: Your Gemini API key

5. Push a commit to trigger the action.

## How It Works

When you push commits to the main/master branch or create/update a pull request:

1. The GitHub Action runs and checks out your code
2. It extracts the diff of your latest commit
3. It sends the original commit message and diff to the Gemini API
4. Gemini generates an enhanced commit message
5. The action amends your commit with the improved message
6. For pull requests, it also enhances the PR description

## Configuration

You can modify these variables in `enhance-commits.js` to customize behavior:

- `MAX_DIFF_SIZE`: Maximum characters of diff to process (default: 20000)
- `MAX_FILES_TO_SAMPLE`: Maximum number of files to include (default: 5)
- `SAMPLE_LINES_PER_FILE`: Maximum lines to include per file (default: 30)

## Limitations

- Requires force-pushing amended commits (`git push --force`)
- Works best with smaller, focused commits
- Large repositories with many files may experience truncated diffs

## Troubleshooting

If you encounter issues:

1. Check the GitHub Actions logs for error messages
2. Verify that your Gemini API key is valid and properly set
3. Consider reducing `MAX_DIFF_SIZE` if your commits are very large
