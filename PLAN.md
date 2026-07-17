# The Plan

My plan with this repo is to build a custom and dynamic forms application. I want to be able to build custom forms, with all kinds of different question types, and then I want to collect responses from who want to participate in my research. I want to build something like google forms, but simpler.

# Desired features

- Question types, text, number, single choice, multiple choice, slide picker (1 to 100 for example)
- Conditional flows, the user will be taken to different questions depending on what he replies
- Auto advance for certain questions. If a question is single choice, as soon as a user taps one option, the app automatically jumops to the next question on the line. Back buttons always available if the user wants to go back
- Able to add images to some questions if needed
- Blank "questions" designed to make a break in the questionaire and just with "continue" and "back" button so the user knows he's leaving a section.
- AB Testing. The user will be taken to different question paths automatically and decided by the app, and not bound by a reply. This is to make possible to run A/B Tests
- Form specification needs to be saved in Mysql DB
- Form Replies needs to be saved in Mysql DB
- Small and simple Admin area that allows to build and manage forms
- Admin login can be a simple password code defined in an env var secret and not users/passwords
  - Auth system with users and password with all the other flows too complex for what this needs
  - build heavy throtle protection to avoid brute force attacks
- Possibility to export replies to CSV on the admin area
- After a form has replies, specification cannot be changed
- Delete all replies button that purges all form submits from a form spec
- Save all form submits as soon as the first reply is made, keep them as status PARTIAL, and move them to FINISHED when the form reaches the or one of the final possible questions.
- Save the following metadata for the form submits:
  - IP Address
  - User Agent
- Possibility to add source to the share link for the form, so I know where the replies came from, for example:
  - https://my-forms.app/form/absd-asd-232-321?source=facebook
  - This will save facebook on the form submit


# Tech stack

- Sveltekit for the framework
- Mysql for DB, 
- AWS s3 for file storage
- Make everything compatible with Cloudflare Workers/Pages, might deploy there but not sure yet.
  - Cloudflare R2 uses same API as S3


