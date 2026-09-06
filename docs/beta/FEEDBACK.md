# Collecting beta feedback

Use one existing group or conversation for this round. Record reports in the supplied CSV files so issues do not disappear in chat.

## A useful bug report

```text
App version:
Windows version / RAM / GPU:
Model and Auto/CPU setting (if relevant):
What I was trying to do:
Steps to reproduce:
Expected result:
Actual result / exact error:
Does it happen again?
Screenshot or short recording:
Did save/reopen preserve the project?
```

Never request an account password, Gemini login, API key, or complete diagnostic dump as routine feedback. A short relevant example is usually enough to reproduce a caption problem.

## Priorities

| Priority | Examples | Response |
| --- | --- | --- |
| P0 | Lost saved work, export attached to the wrong speech, approval bypass | Pause the affected workflow and investigate before more testing |
| P1 | Cannot install, transcribe, reopen, or export | Reproduce on that machine and prioritize the fix |
| P2 | Confusing controls, caption clipping, preview/export mismatch | Record exact settings and address during the beta |
| P3 | Extra presets, fonts, preferences | Keep as requests after core reliability fixes |

Use `test-sessions.csv` for completion and assistance, `issues.csv` for reproducible product defects, and `translation-review.csv` for Arabic/English content errors. Don't place personal contact details in files intended for a public repository.

## Finish the round

Aim for four of five testers exporting without assistance, successful save/reopen, and no unresolved P0 defects. Review actual output clips, not only completion counts. Keep unsuccessful sessions in the results. The broader twenty-excerpt content review and hardware matrix remain in the project's validation document.
