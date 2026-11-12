/* ---------- Terms and Privacy: the two documents, as data ----------
   Written from how Jackwork actually works today, in plain simple
   language. Each document is two layers: a short numbered list of
   the main points first, then the full sections under it. Nothing
   here claims anything the app does not do: no company number, no
   office address, no contact address that does not exist.
   Version 1 is the first version, dated the day it went live. */

export const TERMS_VERSION = 1;
export const TERMS_DATE = "November 12, 2026";

export type LegalDoc = {
  title: string;
  version: number;
  date: string;
  points: string[];
  sections: { heading: string; body: string[] }[];
};

export const TERMS: LegalDoc = {
  title: "Terms and Conditions",
  version: TERMS_VERSION,
  date: TERMS_DATE,
  points: [
    "Your phone number is your account. It cannot be changed.",
    "One person, one profile. Your profile must be you, with your own ID photo.",
    "When you accept a job, call the person through the app first and make sure you understand the work before you go. Phone numbers are never shown in Jackwork.",
    "The price can change once, after the call, only if the person who posted the job agrees. If they say no, the job goes back for others.",
    "Payments are not switched on yet. No real money moves in the app today.",
    "When payments are switched on, money for a job goes through Jackwork by Mobile Money, never hand to hand.",
    "When payments are on, Jackwork holds the money and sends it to the worker when the job is confirmed done. Jackwork takes a cut of the job price.",
    "Both sides must confirm the job is done. The worker marks it done, and the person who posted it confirms it.",
    "If something is wrong, press Problem. Jackwork can then look at the job.",
    "Be honest and treat people well. If you break these rules, your account can be closed.",
  ],
  sections: [
    {
      heading: "What Jackwork is",
      body: [
        "Jackwork connects people who need work done with people who do work, in Liberia.",
        "A person can post a job, and another person can accept the job and do it. The same profile can do both.",
        "Jackwork is in testing now. Some parts, like payments, are not switched on yet.",
      ],
    },
    {
      heading: "Your account",
      body: [
        "You sign up with your name and your phone number. We send you a code, and you type the code. There is no password.",
        "Your phone number is your account. It cannot be changed after you sign up.",
        "One person can have only one profile. Your profile must be you: your name, your photo, and a photo of your own ID, any ID you have.",
        "Do not make a profile for another person, and do not lie about who you are.",
      ],
    },
    {
      heading: "Posting a job",
      body: [
        "Say what the job is, in your own words, and the amount you will pay, in Liberian dollars or US dollars.",
        "Pick the day and the time you want the work, or say you need it now.",
        "Your place is saved on your profile and goes on your jobs by itself. The worker who accepts your job sees how to get to your house. Your phone number is never shown to the worker. Calls are made through the app.",
      ],
    },
    {
      heading: "Taking a job",
      body: [
        "An open job shows only the job name, the amount, when it is, the distance, and the town or community. It does not show the person's phone number or house.",
        "When you accept a job, it is yours. Call the person through the app before you go. Their phone number is never shown to you.",
      ],
    },
    {
      heading: "The call and the price",
      body: [
        "After you accept a job, call the person through the app. Talk about what the work is, what is happening, and what exactly needs to be done, so you do not travel and find a bigger job than you expected.",
        "After the call, tap that you talked and you understand the job.",
        "If the job is bigger or different from what was said, you can change the price once, after the call. The new price works only if the person who posted the job agrees to it.",
        "If they say no, you are released and the job goes back for others, at the first price.",
      ],
    },
    {
      heading: "Paying through Jackwork",
      body: [
        "Payments are not switched on yet in this testing version. No real money moves in the app today, and the app only shows the steps.",
        "When payments are switched on, the person who posted the job sends the money by Mobile Money to Jackwork first. Jackwork holds the money while the work is done.",
        "When the job is confirmed done, Jackwork sends the worker the money, minus the Jackwork cut.",
        "When payments are on, never pay for a Jackwork job hand to hand, and never ask to be paid hand to hand. Money through Jackwork protects both sides.",
      ],
    },
    {
      heading: "Proof of work",
      body: [
        "When the worker starts, the app asks for proof before the work: a photo, a video, or a recording. When the worker marks the job done, it asks for proof after the work.",
        "Proof can be skipped, for example when the work is online, like teaching, a recording can be the proof.",
        "Only the two people on the job can see the proof.",
      ],
    },
    {
      heading: "Finishing a job",
      body: [
        "The worker marks the job done. Then the person who posted it must confirm it is done. One person alone cannot finish a job.",
        "If the person who posted the job does nothing for a long time after the worker marks it done, and nobody pressed Problem, the job can finish by itself so the worker is not kept waiting.",
      ],
    },
    {
      heading: "The Problem button",
      body: [
        "From the price step onward, both sides can press Problem if something is wrong.",
        "Pressing Problem stops the job from finishing by itself, and Jackwork can look at the job in admin to help settle it.",
      ],
    },
    {
      heading: "Ratings",
      body: [
        "After a job is done, both sides can rate each other. Ratings help people choose who to work with.",
        "Rate honestly. Do not rate to punish or to cheat.",
      ],
    },
    {
      heading: "Staying safe",
      body: [
        "Meet carefully. Talk on the phone first, and tell someone where you are going.",
        "Jackwork checks profiles with ID, keeps ratings, and can look at jobs, but Jackwork cannot guarantee how any person will behave. Use your own judgment.",
      ],
    },
    {
      heading: "What is not allowed",
      body: [
        "Lying about who you are, or using another person's ID.",
        "Fake jobs, or accepting jobs you cannot do.",
        "Taking a Jackwork job off Jackwork to dodge the rules, and once payments are on, paying or taking pay outside Jackwork.",
        "Harassing, threatening, or cheating any person.",
        "Posting jobs that are against the law.",
      ],
    },
    {
      heading: "Closed accounts",
      body: [
        "If you break these rules, Jackwork can close your account, and you will not be able to use Jackwork with that number again.",
      ],
    },
    {
      heading: "Changes to these terms",
      body: [
        "Jackwork may change these terms. When they change, the new version will show in the app, and you will be asked to agree again before you continue.",
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  title: "Privacy Policy",
  version: TERMS_VERSION,
  date: TERMS_DATE,
  points: [
    "We keep your name, phone number, where you live, and your ID photo to run Jackwork and keep people safe.",
    "An open job shows only the job name, the amount, when it is, the distance, and the town or community.",
    "Your phone number is never shown to other people in Jackwork. Calls are made through the app.",
    "Your ID photo is never shown to other users. Only Jackwork admin can see it, to check who you are.",
    "We do not sell your information.",
    "In this testing version, your sign-in code shows on your screen, because no text message line is connected yet.",
    "You can ask for your information or your account to be deleted.",
  ],
  sections: [
    {
      heading: "What we collect",
      body: [
        "Your name and phone number.",
        "Where you live: your county, district, town or city, and community, picked from the real place list, and your short house description in your own words.",
        "Your Mobile Money number, when you add it.",
        "Your profile picture, and a photo of your ID.",
        "Your jobs: what the job is, the amount, the day and time, and the place.",
        "Proof photos, videos, or recordings for a job, when the worker adds them.",
        "Your notifications and your ratings.",
      ],
    },
    {
      heading: "Why we collect it",
      body: [
        "To run the service: sign you in, show jobs near you, connect the two people on a job, and show each side the other's progress.",
        "To keep people safe: ID checks, ratings, and looking at a job when a problem is reported.",
      ],
    },
    {
      heading: "Who can see what",
      body: [
        "An open job, before anyone accepts it, shows only the job name, the amount, when it is, the distance, and the town or community. It does not show your name, your phone number, or your house description.",
        "When a worker accepts your job, that worker sees how to get to your house. Your phone number is not shown to the worker, and the worker's phone number is not shown to you. Calls are made through the app, and neither side sees the other side's number in the app.",
        "Your profile picture and your town or community can be seen by other users. Your Mobile Money number is not shown to other users.",
      ],
    },
    {
      heading: "Your ID photo",
      body: [
        "Your ID photo is never shown to other users. It is used to check who you are, and only Jackwork admin can see it.",
      ],
    },
    {
      heading: "Where your information is kept",
      body: [
        "Your information is kept in Jackwork's own database. We do not sell your information to anybody.",
      ],
    },
    {
      heading: "Sign-in codes in this testing version",
      body: [
        "Right now, your sign-in code shows on your screen in the app, because no text message line is connected yet. That means anyone holding your phone can see the code. Keep your phone with you.",
        "When a text message line is connected, codes will come by text instead, and this part will change.",
      ],
    },
    {
      heading: "Your information and deleting it",
      body: [
        "You can see your own information in your profile in the app.",
        "There is no delete button in the app yet. If you want your information or your account deleted, ask Jackwork, and we will delete it from our side.",
      ],
    },
    {
      heading: "Children",
      body: [
        "Jackwork is for adults doing work. If you are under 18, do not use Jackwork.",
      ],
    },
    {
      heading: "Changes to this policy",
      body: [
        "Jackwork may change this policy. When it changes, the new version will show in the app.",
      ],
    },
  ],
};
