# HiveCommand

HiveCommand is a React + Vite application configured for GitHub Pages deployment.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The app is built to `dist/`.

## Deploy to GitHub Pages

This repo includes a GitHub Actions workflow at `.github/workflows/deploy.yml`.

To publish:

1. Push this project to a GitHub repository named `hivecommand`.
2. In GitHub, open `Settings` -> `Pages`.
3. Set the source to `GitHub Actions`.
4. Push to the `main` branch.

The workflow will build the app and publish `dist/` to GitHub Pages automatically.

## Notes

- `vite.config.js` already uses `base: '/hivecommand/'`, which matches a project site hosted at `https://<your-user>.github.io/hivecommand/`.
- If you deploy under a different repository name, update the `base` value in `vite.config.js`.
