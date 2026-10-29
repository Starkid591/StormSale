# Contributing to StormSale

Thank you for your interest in contributing to **StormSale**! As an open-source decentralized affiliate protocol on the Stellar Network, we hold our code quality, security, and developer discipline to the highest standards.

Please review this guide before submitting any issues or Pull Requests.

---

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Treat all contributors with respect and professionalism.

---

## Branching Strategy

> 🚨 **CRITICAL RULE: All Pull Requests MUST target the `dev` branch!**  
> Direct PRs targeting `main` will be automatically rejected. The `main` branch is strictly protected and reserved for audited production releases. All active development, feature implementations, and bug fixes must be integrated into `dev`.

We follow structured Git-Flow conventions:

- `main`: Production-ready, immutable release branch (protected).
- `dev`: Primary integration branch (**all Pull Requests must target this branch**).
- Feature branches: branched from `dev` as `feat/<feature-name>` (e.g., `feat/sac-token-allowance`)
- Bugfix branches: branched from `dev` as `fix/<issue-description>` (e.g., `fix/role-redirect-persistence`)
- Chore/Docs branches: branched from `dev` as `chore/<description>` or `docs/<description>`

---

## Commit Message Standards

All commits must adhere to the **Conventional Commits** specification:

```text
<type>(<scope>): <short descriptive summary in imperative mood>

[optional body]
[optional footer(s)]
```

### Allowed Types:

- `feat`: A new user-facing feature or enhancement.
- `fix`: A bug fix or defect correction.
- `docs`: Documentation updates only.
- `style`: Formatting, missing semicolons, whitespace changes.
- `refactor`: Code restructuring without changing behavior or adding features.
- `perf`: Code changes that improve execution performance.
- `test`: Adding missing unit/integration tests or correcting existing tests.
- `chore`: Changes to build process, tooling, or package configurations.

### 🚨 Forbidden Commit Habits:

- Generic commit messages (e.g., `update`, `fix stuff`, `changes`, `checkpoint`).
- Fake or auto-generated commit spam.
- Bundling unrelated changes across multiple domains into a single commit.

---

## Pull Request Requirements

Every PR submitted to StormSale must satisfy our **Quality Gate**:

1. **Target Branch**: **Your PR MUST target the `dev` branch.** PRs opened against `main` will be closed with a request to re-target `dev`.
2. **Self-Contained & Scoped**: Keep PRs focused on a single issue or feature.
3. **Visual Proof**: If modifying UI components, you **MUST** attach screenshots or a screen recording GIF demonstrating the change in both desktop and mobile viewports.
4. **Automated Validation**:
   Before submitting, ensure all pre-flight checks pass locally:
   ```bash
   npm run lint
   npm run build
   ```
5. **Structured PR Description**:
   Use our standard PR template covering:
   - **Summary**: What changed?
   - **Why**: Why was this change required?
   - **How**: Key technical decisions.
   - **Verification**: Exact commands run and manual test evidence.
   - **Issue Reference**: `Closes #<issue_number>`

---

## Local Development Workflow

```bash
# 1. Clone the repository
git clone https://github.com/StormSale/StormSale.git
cd StormSale

# 2. Switch to the dev branch before branching off
git checkout dev
git pull origin dev

# 3. Create your feature branch off dev
git checkout -b feat/your-feature-name

# 4. Install dependencies
npm install

# 5. Create environment file
cp .env.example .env

# 6. Start local development server
npm run dev
```
