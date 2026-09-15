# HighLevel Help Center (Demo Excerpt)

## Overview

HighLevel is an all-in-one, white-label sales and marketing platform built for agencies and
their clients. Agencies consolidate CRM, funnels, email and SMS marketing, appointment
booking, reputation management, and automation into a single dashboard, and resell that
platform under their own brand. Instead of stitching together separate tools, an agency runs
everything for every client from one login. The platform is delivered as a web application
with companion mobile apps for iOS and Android.

## Sub-Accounts (Locations)

Each client an agency serves gets its own **sub-account**, also called a **Location**. A
sub-account holds that client's contacts, calendars, funnels, workflows, and conversations,
fully isolated from other clients. From the **Agency View**, an admin can switch between all
sub-accounts, create new ones, and manage user access. There is no hard limit on the number of
sub-accounts on the Unlimited and Pro plans. Each sub-account has its own time zone, business
profile, and billing configuration, so an agency in one region can serve clients across many
regions without data bleeding between accounts.

## User Roles and Permissions

HighLevel has two account levels: **Agency** users and **Sub-Account** users. Within a
sub-account, a user is either an **Admin** or a **User**. Admins can see and edit everything in
that sub-account, including settings and billing; plain Users are restricted to the areas an
admin grants them. Agency-level admins can additionally impersonate ("act as") any sub-account
user for support. Granular permissions let you hide specific tabs — for example, hiding the
Payments tab from a junior team member while leaving Conversations visible.

## Contacts

Contacts are the core records in HighLevel. You can import contacts in bulk from a CSV file,
map the columns to standard or custom fields during import, and organize them with tags. Each
contact record stores activity history: messages sent and received, appointments booked, form
submissions, and notes. Duplicate contacts are merged by matching on email or phone number.
The maximum CSV import size is 50,000 rows per file; larger lists must be split.

## Custom Fields and Custom Values

**Custom fields** store data specific to your business on each contact — a policy number, a
preferred appointment time, a lead source. Field types include text, number, date, dropdown,
checkbox, and file upload. **Custom values** are account-level placeholders (like a mail-merge
variable) such as `{{location.name}}` or `{{custom_values.support_phone}}` that get substituted
into emails, SMS, and funnels at send time, so you update a value once and every template
reflects it.

## Smart Lists and Tags

**Smart Lists** are saved, filtered views of contacts — for example, "all leads tagged
`webinar` created in the last 30 days." Filters can combine tags, custom fields, activity, and
date ranges. **Tags** are simple labels applied to contacts, either manually or automatically
by a workflow, and are the most common way to segment an audience for campaigns.

## Workflows and Automation

**Workflows** are HighLevel's visual automation builder. A workflow starts with a **trigger**
(something that happens, such as a form submission or a new inbound SMS) and runs a series of
**actions** (send an email, wait two hours, add a tag, create an opportunity). Workflows
support **if/else branches** based on contact data, **wait steps** that pause until a condition
or time, and **goal events** that let a contact skip ahead when they take a desired action. For
example: when a contact submits the "Book a Demo" form, the workflow can immediately send a
confirmation SMS, wait one day, and then send a follow-up email only if no appointment was
booked. Workflows replace the older Campaigns and Triggers features, which are now read-only.

## Funnels and Websites

HighLevel includes a drag-and-drop builder for **funnels** (multi-step conversion flows) and
full **websites**. Pages are built from sections, rows, and elements, and every page is mobile
responsive by default. You can A/B split-test funnel steps, attach an order form or survey to
a step, and connect a custom domain. Templates can be saved and reused, or imported from the
marketplace.

## Forms and Surveys

**Forms** capture leads inline or as pop-ups; **Surveys** ask multi-step questions with
conditional logic that shows or hides questions based on prior answers. Both can trigger
workflows on submission and write their answers straight onto the contact record as custom
fields.

## Calendars and Appointments

HighLevel includes a built-in calendar and booking system. There are four calendar types:
**Round-robin** (distributes bookings evenly across multiple team members in rotation),
**Collective** (books a slot only when all chosen team members are free), **Class booking**
(one host, many attendees, for webinars or group sessions), and **Service** calendars (for
service businesses with specific offerings). Contacts book time slots through a public booking
page and the appointment is written straight into the sub-account's calendar.

## Appointment Reminders

Reminders can be sent automatically over SMS and email before each appointment, at intervals
you configure — for example 24 hours and 1 hour before. No-show and confirmation follow-ups can
be automated through a workflow triggered by the appointment status changing.

## Conversations (Unified Inbox)

The **Conversations** tab is a unified inbox. Messages from SMS, email, WhatsApp, Facebook
Messenger, Instagram DMs, and Google Business Messages all land in one thread per contact, so a
team member can reply across every channel from a single screen without switching apps. The
inbox supports snippets (saved replies), internal notes, and message scheduling.

## Phone System

Voice and SMS run on a phone number you provision inside the platform through the built-in
telephony, which is powered by Twilio under the hood (branded as LC Phone when using
HighLevel's managed number pool). You can buy local or toll-free numbers, set up IVR menus,
record calls, and forward to a mobile. A2P 10DLC registration is required before sending SMS to
US numbers, and the platform walks you through that registration.

## Email Sending

Marketing and transactional email is sent through Mailgun, offered as **LC Email** when using
HighLevel's managed sending infrastructure. You can also connect your own SMTP provider.
Dedicated sending domains must be authenticated with SPF and DKIM records before campaigns can
go out, which protects deliverability.

## Reputation Management

The **Reputation** tools request reviews from customers over SMS and email after a job is
completed, and aggregate incoming reviews from Google Business Profile and Facebook into one
dashboard. You can respond to reviews from inside HighLevel and set up automated review-request
sequences triggered when an opportunity is marked won.

## Opportunities and Pipelines

**Opportunities** represent deals moving through a sales **pipeline**. Each pipeline has custom
stages (for example: New Lead → Contacted → Quoted → Won), and opportunities carry a monetary
value so you can forecast revenue. Opportunities can be created and advanced automatically by
workflows, and the pipeline board gives a drag-and-drop Kanban view.

## Memberships and Courses

HighLevel can host **membership sites** and **online courses**. You build courses from modules
and lessons, drip content on a schedule, gate it behind a paid or free offer, and track learner
progress. This lets agencies sell coaching programs and client education without a separate LMS.

## Communities

**Communities** are group spaces (similar to a private social group) where members post, comment,
and join channels. They can be free or paid, and paid communities are tied to the payments
system so access is granted on successful purchase.

## Payments and Invoicing

Payments are collected through **Stripe** (with PayPal and other processors also supported).
You can sell one-time and recurring products, send **invoices** and estimates, set up
**subscriptions**, and build **coupons**. Text-to-pay lets you send a payment link over SMS.
Revenue collected through the platform appears in the sub-account's reporting.

## SaaS Mode

**SaaS Mode** lets an agency sell HighLevel to its own clients as a branded software product,
with automated sign-up, Stripe-based billing, and plan management handled by the platform. It
also enables **rebilling** — marking up the usage cost of Twilio (SMS/calls) and Mailgun
(email) and charging clients the marked-up rate automatically, so the agency earns margin on
usage. SaaS Mode is configured from the Agency dashboard and is available only on the **SaaS
Pro** plan.

## Snapshots

A **Snapshot** is a reusable template of a sub-account's setup — its workflows, funnels,
calendars, custom fields, pipelines, and more. You build a configuration once, save it as a
snapshot, and then apply that snapshot to any new sub-account to clone the whole setup in one
step. Snapshots can also be shared via a link or sold in the marketplace, and an agency can
push snapshot updates to sub-accounts that were created from it.

## Marketplace

The **Marketplace** is where agencies find and install snapshots, funnel templates, and
third-party apps and integrations that extend HighLevel. Developers can publish apps built on
the public API and charge for them.

## Reporting and Dashboards

HighLevel provides dashboards for pipeline value, appointment volume, ad-campaign attribution
(Google and Facebook Ads), call and message reporting, and agency-wide rollups across all
sub-accounts. Dashboards are customizable with widgets, and reports can be scheduled to email
automatically.

## Mobile App

The **LeadConnector** mobile app (iOS and Android) gives team members the inbox, calendar,
contacts, and payments on the go, with push notifications for new messages and booked
appointments. Agencies can white-label the mobile app on the higher plans.

## Plans and Pricing

HighLevel offers three plans:

- **Starter — $97/month.** Core CRM, funnels, calendars, and unlimited contacts, for a single
  business (up to three sub-accounts).
- **Unlimited — $297/month.** Everything in Starter plus unlimited sub-accounts and the branded
  desktop app, aimed at agencies managing many clients.
- **SaaS Pro — $497/month.** Everything in Unlimited plus SaaS Mode, rebilling, and the
  white-label mobile app.

A 14-day free trial is available on all plans, and annual billing gives two months free.

## Support

HighLevel provides 24/7 live chat support from inside the dashboard, an extensive help-center
knowledge base, daily live onboarding calls (Bootcamp), and an official community for users to
share templates and ask questions.
