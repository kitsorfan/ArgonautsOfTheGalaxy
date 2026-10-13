# Security policy

Argonauts of the Galaxy is a free, open-source game for Android, made by one person. If you find a security problem in it, thank you for taking the time to report it.

## Supported versions

Only the latest release gets security fixes.

| Version | Supported |
| --- | --- |
| 1.0.x | Yes |
| Older versions (including AstroTroubles!) | No: please update |

## Reporting a vulnerability

Please **don't open a public issue** for a security problem. Report it privately instead, in either of these ways:

- **GitHub:** on this repository's **Security** tab, click **Report a vulnerability**.
- **Email:** [kitsorfan@protonmail.com](mailto:kitsorfan@protonmail.com), with "Security" in the subject.

Please include:

- what the problem is and what someone could do with it;
- the steps to reproduce it (the game version, and the phone and Android version if it matters);
- any proof of concept, logs or screenshots.

I'll reply as soon as I can, keep you updated while I work on a fix, and credit you in the release notes if you'd like. Please give me a reasonable amount of time to release a fix before you share details publicly.

## What's in scope

The game has no accounts, no servers, no ads, no analytics and no in-app purchases, and it never sends anything over the internet (see the [privacy policy](docs/privacy-policy.md)). So the useful reports are about:

- the Android app (the Expo / React Native shell in `src/`), including the bridge between the app and the game page;
- the game page itself (`game/`), which runs in a WebView;
- how the game saves progress on the device;
- secrets or personal data accidentally committed to this repository;
- the build setup and dependencies, where a vulnerable package actually affects the game.

Not in scope:

- cheating in the game, such as editing your own save to get more bolts;
- problems that need a rooted phone or physical access to an unlocked phone;
- a vulnerable dependency that the game doesn't actually use in a way that matters;
- Google Play, Expo or GitHub themselves (please report those to them).
