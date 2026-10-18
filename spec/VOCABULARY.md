# HUMANS.md vocabulary, version 0.3 (draft)

Closed lists used by [SPEC.md](SPEC.md). Strict writers reject values outside these lists. Known-version readers omit unknown enum values under SPEC § 3.10. Stable vocabulary changes require a new format version; unpublished draft revisions are identified by source commit and contract revision (see CONTRIBUTING.md). There is no medical word blacklist.

## Roles (`context.role`)

`software-engineer`, `senior-engineer`, `staff-engineer`, `principal-engineer`, `tech-lead`, `architect`, `engineering-manager`, `director-of-engineering`, `vp-engineering`, `cto`, `sre`, `devops-engineer`, `security-engineer`, `qa-engineer`, `data-engineer`, `data-scientist`, `ml-engineer`, `product-manager`, `product-owner`, `designer`, `ux-researcher`, `technical-writer`, `founder`, `ceo`, `coo`, `cfo`, `operations`, `marketing`, `sales`, `customer-support`, `legal`, `finance`, `people-ops`, `researcher`, `student`

## Topics (`context.knows_well`, `context.knows_little`)

`javascript`, `typescript`, `python`, `php`, `ruby`, `go`, `rust`, `java`, `kotlin`, `swift`, `c-cpp`, `csharp-dotnet`, `elixir`, `scala`, `sql`, `shell`, `react`, `vue`, `svelte`, `angular`, `node`, `symfony`, `laravel`, `rails`, `django`, `spring`, `frontend`, `backend`, `mobile`, `apis`, `distributed-systems`, `databases`, `postgres`, `mysql`, `mongodb`, `redis`, `search`, `caching`, `messaging`, `data-pipelines`, `analytics`, `machine-learning`, `llm-agents`, `infrastructure`, `kubernetes`, `docker`, `terraform`, `ci-cd`, `observability`, `incident-response`, `performance`, `security`, `identity-auth`, `networking`, `cloud-aws`, `cloud-gcp`, `cloud-azure`, `cloudflare`, `cloud-costs`, `testing`, `accessibility`, `design-systems`, `ux-research`, `product-strategy`, `roadmap`, `pricing`, `billing-payments`, `growth`, `seo`, `marketing`, `sales`, `customer-support`, `compliance`, `privacy-gdpr`, `legal`, `finance`, `hiring`, `people-management`, `project-management`, `documentation`, `open-source`

## Decisions (`context.decides`)

`architecture`, `schema-changes`, `api-contracts`, `dependencies`, `infra-budget`, `vendor-choice`, `security-exceptions`, `data-access`, `release-scope`, `release-timing`, `roadmap-priority`, `pricing`, `design`, `copy-and-content`, `hiring`, `team-organization`, `incident-escalation`, `legal-review`, `spending`

## Visibility (`visibility`)

`private` (the owner only), `org` (authenticated members of the owner's organization), `anyone_with_file` (any reader who has the file; the consumer checks nothing, so where the file is stored controls access). A reader maps `public` in a `"0.2"` profile to `anyone_with_file`; in `"0.3"`, `public` is unknown and makes the profile absent (SPEC § 3.10).

## Time zones (`interrupting.quiet_hours.time_zone`)

The 418 names in `zone.tab` of IANA tz database release 2026e, plus `UTC`: 419 names, listed in the profile schema under `$defs.timeZone`. The list is pinned so that validity never depends on a runtime's time zone data; adopting a newer release is a contract change. A reader omits `quiet_hours` when its name is not on the list (SPEC § 3.10).

## Weekdays (`interrupting.quiet_hours.all_day`)

`monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`

## Words addressed to an agent

The baseline consumer withholds a note containing one of these expressions (SPEC § 6.2). Match using NFD, removal of Unicode marks, lowercase, non-letter/non-number runs replaced by one space and whole-word phrase boundaries. This is a bounded heuristic, not a safety guarantee. False positives can lose meaningful information and must be visible to the owner; missed imperatives still have no authority. Do not apply this list as a medical filter or use it to invalidate a file. The machine list is schema/terms.json.

English: `ignore`, `disregard`, `forget`, `override`, `bypass`, `instead`, `pretend`, `roleplay`, `act as`, `you are now`, `send`, `forward`, `email`, `emails`, `mail`, `cc`, `bcc`, `post`, `publish`, `share`, `upload`, `download`, `delete`, `remove`, `run`, `execute`, `call`, `invoke`, `fetch`, `browse`, `click`, `tool`, `tools`, `system`, `assistant`, `developer`, `prompt`, `prompts`, `instruction`, `instructions`, `jailbreak`, `secret`, `secrets`, `password`, `passwords`, `token`, `tokens`, `credential`, `credentials`, `api`, `ssh`, `env`

French: `ignore`, `ignorer`, `oublie`, `oublier`, `envoie`, `envoyer`, `transfere`, `transferer`, `copie`, `copier`, `publie`, `publier`, `partage`, `partager`, `supprime`, `supprimer`, `execute`, `executer`, `lance`, `lancer`, `appelle`, `appeler`, `outil`, `outils`, `systeme`, `consigne`, `consignes`, `mot de passe`, `jeton`, `jetons`, `au lieu`
