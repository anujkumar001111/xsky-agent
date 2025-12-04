---
name: red-team-bug-bounty-overview
description: Overview of red team and bug bounty subagents for offensive security operations and vulnerability research
---

# Red Team & Bug Bounty Subagents

Red Team & Bug Bounty subagents are your offensive security specialists, focused on discovering vulnerabilities before malicious actors do. These experts simulate real-world attacks, conduct penetration testing, and hunt for security flaws across web applications, networks, and infrastructure. They operate ethically within defined scopes to improve organizational security posture.

## 🎯 When to Use Red Team & Bug Bounty Subagents

Use these subagents when you need to:
- **Simulate advanced threats** against your infrastructure
- **Discover vulnerabilities** in web applications and APIs
- **Test security controls** and incident response capabilities
- **Conduct penetration testing** with realistic attack scenarios
- **Participate in bug bounty programs** effectively
- **Assess security posture** from an attacker's perspective
- **Validate security fixes** and control implementations
- **Train blue teams** through purple team exercises

## 📋 Available Subagents

### [**red-team-operator**](../subagents/11_red_team_bug_bounty/red-team-operator.md) - Advanced persistent threat simulator
Expert in full-spectrum offensive security operations and adversary emulation. Masters MITRE ATT&CK framework, C2 infrastructure, lateral movement, and persistence mechanisms. Simulates realistic APT campaigns to test organizational defenses.

**Use when:** Conducting red team engagements, simulating APT attacks, testing incident response, implementing C2 infrastructure, or performing adversary emulation exercises.

### [**bug-bounty-hunter**](../subagents/11_red_team_bug_bounty/bug-bounty-hunter.md) - Vulnerability researcher
Expert in web application security, API testing, and responsible disclosure. Masters OWASP Top 10, business logic flaws, and modern attack vectors. Specializes in finding high-impact vulnerabilities in real-world applications.

**Use when:** Hunting for web vulnerabilities, testing APIs, participating in bug bounty programs, conducting security assessments, or validating security fixes.

### [**web-app-pentester**](../subagents/11_red_team_bug_bounty/web-app-pentester.md) - Web application security tester
Specialist in comprehensive web application penetration testing. Expert in injection attacks, authentication bypass, session management flaws, and client-side vulnerabilities. Provides detailed findings and remediation guidance.

**Use when:** Testing web applications, assessing authentication systems, evaluating session management, or conducting comprehensive web security assessments.

### [**backend-security-coder**](../subagents/11_red_team_bug_bounty/backend-security-coder.md) - Secure backend development
Expert in writing secure server-side code and identifying backend vulnerabilities. Masters secure coding practices, input validation, and backend attack prevention. Bridges offensive and defensive security.

**Use when:** Reviewing backend code security, implementing secure APIs, fixing server-side vulnerabilities, or developing security-hardened services.

### [**frontend-security-coder**](../subagents/11_red_team_bug_bounty/frontend-security-coder.md) - Secure frontend development
Specialist in client-side security and frontend vulnerability prevention. Expert in XSS prevention, CSP implementation, and secure JavaScript practices. Ensures frontend code resists attacks.

**Use when:** Securing frontend applications, implementing CSP headers, preventing XSS attacks, or reviewing client-side security.

### [**mobile-security-coder**](../subagents/11_red_team_bug_bounty/mobile-security-coder.md) - Mobile application security
Expert in iOS and Android security testing and secure mobile development. Masters mobile-specific vulnerabilities, API security, and data protection on mobile platforms.

**Use when:** Testing mobile applications, securing mobile APIs, implementing mobile data protection, or assessing mobile app security.

### [**osint-specialist**](../subagents/11_red_team_bug_bounty/osint-specialist.md) - Open source intelligence expert
Master of reconnaissance and information gathering from public sources. Expert in subdomain enumeration, social engineering research, and attack surface mapping. Provides comprehensive target intelligence.

**Use when:** Conducting reconnaissance, mapping attack surfaces, gathering target intelligence, or performing social engineering research.

## 🚀 Quick Selection Guide

| If you need to... | Use this subagent |
|-------------------|-------------------|
| Simulate APT attacks | **red-team-operator** |
| Hunt web vulnerabilities | **bug-bounty-hunter** |
| Test web applications | **web-app-pentester** |
| Secure backend code | **backend-security-coder** |
| Secure frontend code | **frontend-security-coder** |
| Test mobile apps | **mobile-security-coder** |
| Gather intelligence | **osint-specialist** |

## 💡 Common Combinations

**Full Red Team Engagement:**
- Start with **osint-specialist** for reconnaissance
- Use **red-team-operator** for attack simulation
- Add **web-app-pentester** for application testing
- Employ **bug-bounty-hunter** for vulnerability discovery

**Bug Bounty Campaign:**
- Begin with **osint-specialist** for target mapping
- Use **bug-bounty-hunter** for vulnerability hunting
- Add **web-app-pentester** for deep application testing
- Employ **backend-security-coder** for code-level analysis

**Security Code Review:**
- Use **backend-security-coder** for server-side review
- Add **frontend-security-coder** for client-side review
- Employ **mobile-security-coder** for mobile review
- Validate with **bug-bounty-hunter** for exploitation attempts

**Penetration Testing:**
- Start with **osint-specialist** for reconnaissance
- Use **web-app-pentester** for application testing
- Add **red-team-operator** for network/infrastructure testing
- Document with **bug-bounty-hunter** reporting methodology

## 🎬 Getting Started

1. **Define scope and rules of engagement** before any testing
2. **Obtain proper authorization** for all security testing activities
3. **Choose appropriate subagents** based on target and objectives
4. **Document everything** for comprehensive reporting
5. **Practice responsible disclosure** for any findings

Each subagent comes with:
- Deep expertise in offensive security techniques
- Knowledge of current attack vectors and methodologies
- Ability to work within defined scope and rules
- Focus on ethical hacking and responsible disclosure
- Understanding of real-world attacker tradecraft

## 📚 Best Practices

- **Always get authorization:** Never test without explicit permission
- **Define clear scope:** Know what's in-bounds and out-of-bounds
- **Document thoroughly:** Maintain detailed logs of all activities
- **Minimize impact:** Avoid causing damage or accessing unnecessary data
- **Report responsibly:** Follow proper disclosure timelines and processes
- **Stay legal:** Understand and comply with applicable laws and regulations
- **Continuous learning:** Adversary techniques evolve constantly
- **Collaborate with defenders:** Purple team exercises maximize value

## ⚠️ Ethical Guidelines

All red team and bug bounty activities must:
- Have explicit written authorization
- Stay within defined scope boundaries
- Avoid accessing or exfiltrating real user data
- Not cause service disruption or denial of service
- Follow responsible disclosure practices
- Comply with program rules and legal requirements
- Prioritize organizational security improvement

Choose your offensive security specialist and start improving security posture today!
