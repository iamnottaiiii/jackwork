/* ---------- Terms and Privacy: the documents, as data ----------
   Two full Terms sets, one for Workers and one for Users. At
   create account the person picks Worker or User, reads the
   terms for their pick, and agrees to those terms. Each document
   is two layers: a short numbered list of the main points first,
   then the full sections under it. Both sets are complete and
   final, written in plain clear words from how Jackwork works:
   a marketplace that connects people who post jobs (Users) with
   independent workers (Workers). Version 2 is the first version
   with the two sets, dated the day it went live. */

export const TERMS_VERSION = 2;
export const TERMS_DATE = "November 12, 2026";

export type TermsRole = "worker" | "user";

export type LegalDoc = {
  title: string;
  version: number;
  date: string;
  points: string[];
  sections: { heading: string; body: string[] }[];
};

export const WORKER_TERMS: LegalDoc = {
  title: "Worker Terms",
  version: TERMS_VERSION,
  date: TERMS_DATE,
  points: [
    "Your phone number is your account. It cannot be changed.",
    "One person, one profile. Your profile must be you, with your own photo and a photo of your own ID.",
    "Only accept a job you can do. If you cannot do the work, do not accept the job.",
    "When you accept a job, talk to the person inside the app first and make sure you understand the work before you go.",
    "Phone numbers are never shown in Jackwork. You talk by chat and calls inside the app.",
    "After the talk, you can keep the posted price or ask for a new price one time. The person who posted the job must agree. If they say no, the job goes back for others.",
    "The person who posted the job sends the money by Mobile Money through Jackwork. Jackwork holds the money while you work.",
    "Start the work only after the app shows that Jackwork has the money.",
    "The app asks for proof of your work: proof before you start, and proof when you mark the job done. Proof can be a photo, a video, or a recording.",
    "The job is finished when you mark it done and the person who posted it confirms it is done. Then Jackwork sends your pay to your Mobile Money.",
    "Jackwork takes 10 percent of the job price. You receive 90 percent.",
    "If something is wrong, press Problem. The job stops, no money moves, and Jackwork looks at the job.",
    "Be honest and treat people well. If you break these rules, your account can be closed.",
  ],
  sections: [
    {
      heading: "What Jackwork is",
      body: [
        "Jackwork is a marketplace in Liberia. It connects people who need work done with people who do work.",
        "You are an independent worker. Jackwork does not employ you, and a person who posts a job does not employ you. You choose which jobs to accept, and you are responsible for your own work.",
        "The same profile can also post jobs. When you post a job, the User Terms are the rules for that side, and these Worker Terms are the rules when you take work.",
      ],
    },
    {
      heading: "Your account",
      body: [
        "You sign up with your name and your phone number. We send you a code, and you type the code. There is no password.",
        "Your phone number is your account. It cannot be changed after you sign up.",
        "One person can have only one profile. Your profile must be you: your name, your photo, and a photo of your own ID, any ID you have.",
        "Do not make a profile for another person, and do not lie about who you are.",
        "Keep your phone safe. Anyone holding your phone can open your account.",
      ],
    },
    {
      heading: "Your place",
      body: [
        "You pick where you live from the real place list in the app: your county, then your district, then your city or town, then your community if your town has one. You also write one short description of how to get to your house, in your own words.",
        "Your place helps Jackwork show you jobs near you and show how far a job is. Keep it true.",
      ],
    },
    {
      heading: "Taking a job",
      body: [
        "An open job shows only the job name, the amount, when it is, the distance, and the town or community. It does not show the person's name, phone number, or house.",
        "Accept only jobs you can truly do, with the skill, the tools, and the time the job needs. Accepting a job you cannot do wastes the other person's time and can close your account.",
        "When you accept a job, it is yours, and it leaves the board for others.",
        "If your trade needs a license or papers, like electrical work or nursing, you must have them and they must be real. Jackwork can ask to see them.",
      ],
    },
    {
      heading: "Talk first, inside the app",
      body: [
        "After you accept a job, talk to the person inside Jackwork before you go: send chat messages, or call in the app. The call goes over the internet inside the app. No phone numbers are shown or used, and the call costs nothing.",
        "Talk about what the work is, what is happening, and what exactly needs to be done, so you do not travel and find a bigger job than you expected.",
        "After the talk, tap that you talked and you understand the job. The job then moves to confirmed.",
      ],
    },
    {
      heading: "The price",
      body: [
        "The posted price is the starting price. After the talk, you can keep it, or you can ask for a new price one time, in the same currency as the job.",
        "Ask honestly. The new price must be for the real work you talked about, not a trick to raise the price after you arrive.",
        "The new price works only if the person who posted the job agrees to it in the app. If they say no, you are released and the job goes back for others at the first price. There are no second rounds.",
      ],
    },
    {
      heading: "Getting paid through Jackwork",
      body: [
        "All pay for a Jackwork job goes through Jackwork by Mobile Money. Never take pay hand to hand for a Jackwork job, and never ask the person to pay you outside the app. Money through Jackwork protects you: the pay is there before you start.",
        "After the job is confirmed, the person who posted it sends the full amount by Mobile Money through Jackwork. Jackwork holds the money while you work.",
        "Start the work only after the app shows that Jackwork has the money. If the app does not show it, do not start.",
        "When the job is confirmed done, Jackwork sends your pay to the Mobile Money number on your profile. Keep that number correct and yours.",
        "Jackwork takes 10 percent of the job price as its cut. You receive 90 percent. The amount the app shows as your pay already has the cut taken out.",
      ],
    },
    {
      heading: "Proof of work",
      body: [
        "When you start a job, the app asks for proof before the work: a photo, a video, or a recording. When you mark the job done, it asks for proof after the work.",
        "Proof can be skipped when it does not fit the work. For online work, like teaching, a recording can be the proof.",
        "Only the two people on the job can see the proof. If a Problem is reported, Jackwork can also look at the proof to help settle the job.",
        "Never send fake proof. Fake proof can close your account and stop your pay.",
      ],
    },
    {
      heading: "Finishing a job and ratings",
      body: [
        "Mark the job done only when the work is truly done. Then the person who posted it confirms it is done. One person alone cannot finish a job.",
        "If the person who posted the job does nothing for a long time after you mark it done, and nobody pressed Problem, the job can finish by itself so your pay is not kept waiting.",
        "After a job is done, the person can rate you, and you can rate them. Ratings help people choose who to work with. Your ratings stay on your profile.",
      ],
    },
    {
      heading: "The Problem button",
      body: [
        "From the price step onward, you can press Problem if something is wrong: the job is not what was said, the person will not answer, or anything else is not right.",
        "Pressing Problem stops the job from finishing by itself and holds the money where it is. Jackwork can look at the job, including the chat and the proof, to help settle it.",
        "Use Problem honestly. Do not press it to hold a job you do not want to finish.",
      ],
    },
    {
      heading: "Staying safe",
      body: [
        "Talk in the app first, and tell someone where you are going and when you will be back.",
        "Do not go into a place that feels unsafe. Leave, and press Problem in the app.",
        "Jackwork checks profiles with ID, keeps ratings, and can look at jobs when a Problem is reported, but Jackwork cannot guarantee how any person will behave. Use your own judgment.",
      ],
    },
    {
      heading: "What is not allowed",
      body: [
        "Lying about who you are, or using another person's ID.",
        "Accepting jobs you cannot do, or taking a job and not showing up without telling the person.",
        "Fake proof, fake ratings, or cheating on price.",
        "Taking a Jackwork job off Jackwork to dodge the cut or the rules, and taking pay outside the app.",
        "Harassing, threatening, or stealing from any person.",
        "Work that is against the law.",
      ],
    },
    {
      heading: "Closed accounts",
      body: [
        "If you break these rules, Jackwork can close your account, and you will not be able to use Jackwork with that number again.",
        "If your account is closed while a job is open, Jackwork will settle that job in a fair way, including holding or returning money based on the work truly done.",
      ],
    },
    {
      heading: "Jackwork's responsibility",
      body: [
        "Jackwork provides the marketplace, holds job money as these terms say, and helps settle problems it can see. Jackwork is not responsible for the quality of any person's work, for injuries, or for loss that comes from a job between two people.",
        "If the app or the Mobile Money network fails during a payment, Jackwork will fix the record so the money follows these terms: held while the work is done, paid to the worker when the job is confirmed done, or returned to the person who posted the job when the job does not happen.",
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

export const USER_TERMS: LegalDoc = {
  title: "User Terms",
  version: TERMS_VERSION,
  date: TERMS_DATE,
  points: [
    "Your phone number is your account. It cannot be changed.",
    "One person, one profile. Your profile must be you, with your own photo and a photo of your own ID.",
    "Describe your job truly and clearly, and say the amount you will pay.",
    "Workers are independent people, not Jackwork workers. Jackwork connects you; the worker does the job.",
    "Phone numbers are never shown in Jackwork. You talk by chat and calls inside the app.",
    "The worker talks with you first and can ask for a new price one time. You can agree, or say no and the job goes back for others at your first price.",
    "When the job is confirmed, send the full amount by Mobile Money through Jackwork. Never pay hand to hand.",
    "Jackwork holds your money while the work is done. Your money does not go to the worker until you confirm the job is done.",
    "Confirm the job is done only when the work is truly done. When you confirm, Jackwork sends the worker their pay.",
    "Jackwork takes 10 percent of the job price as its cut. The worker receives 90 percent.",
    "If something is wrong, press Problem. The job stops, no money moves, and Jackwork looks at the job.",
    "Be honest and treat people well. If you break these rules, your account can be closed.",
  ],
  sections: [
    {
      heading: "What Jackwork is",
      body: [
        "Jackwork is a marketplace in Liberia. It connects people who need work done with people who do work.",
        "Workers on Jackwork are independent people. Jackwork does not employ them, and you do not employ them. You hire a worker for one job, and the worker is responsible for their own work.",
        "The same profile can also take jobs. When you take a job, the Worker Terms are the rules for that side, and these User Terms are the rules when you post jobs.",
      ],
    },
    {
      heading: "Your account",
      body: [
        "You sign up with your name and your phone number. We send you a code, and you type the code. There is no password.",
        "Your phone number is your account. It cannot be changed after you sign up.",
        "One person can have only one profile. Your profile must be you: your name, your photo, and a photo of your own ID, any ID you have.",
        "Do not make a profile for another person, and do not lie about who you are.",
        "Keep your phone safe. Anyone holding your phone can open your account.",
      ],
    },
    {
      heading: "Your place",
      body: [
        "You pick where you live from the real place list in the app: your county, then your district, then your city or town, then your community if your town has one. You also write one short description of how to get to your house, in your own words.",
        "Your place goes on your jobs by itself. A worker sees how far the job is, and the worker who accepts your job sees how to get to your house. Your phone number is never shown to the worker.",
      ],
    },
    {
      heading: "Posting a job",
      body: [
        "Say what the job is, in your own words, and answer the short questions for that kind of work honestly. Say what is happening and what exactly you need done.",
        "Say the amount you will pay, in Liberian dollars or US dollars, and pick the day and the time you want the work, or say you need it now.",
        "Do not post fake jobs, and do not post jobs that are against the law.",
        "An open job shows only the job name, the amount, when it is, the distance, and the town or community. It does not show your name, your phone number, or your house.",
      ],
    },
    {
      heading: "Talk first, inside the app",
      body: [
        "When a worker accepts your job, talk inside Jackwork before the worker comes: send chat messages, or call in the app. The call goes over the internet inside the app. No phone numbers are shown or used, and the call costs nothing.",
        "Use the talk to make the job clear: what the work is, what is happening, and what exactly needs to be done, so the worker does not travel and find a different job than expected.",
        "Answer the worker's messages and calls. A job cannot move forward if you do not talk.",
      ],
    },
    {
      heading: "The price",
      body: [
        "Your posted price is the starting price. After the talk, the worker can keep it, or ask for a new price one time, in the same currency as the job.",
        "You can agree to the new price, or say no. If you agree, the new price is the job price everywhere, including the amount you send.",
        "If you say no, the worker is released and the job goes back for others at your first price. There are no second rounds.",
        "Do not promise one price in the app and a different price in person. The price in the app is the price.",
      ],
    },
    {
      heading: "Paying through Jackwork",
      body: [
        "All pay for a Jackwork job goes through Jackwork by Mobile Money. Never pay hand to hand for a Jackwork job, and never agree to pay outside the app. Money through Jackwork protects you: the worker is not paid until you confirm the work is done.",
        "After the job is confirmed and the price is settled, send the full job amount by Mobile Money through Jackwork. You approve the payment on your own phone with your own Mobile Money PIN. Jackwork never sees your PIN.",
        "Jackwork holds your money while the work is done. The worker starts only after the app shows that Jackwork has the money.",
        "When you confirm the job is done, Jackwork sends the worker their pay from the held money.",
        "Jackwork takes 10 percent of the job price as its cut. The worker receives 90 percent. The cut comes out of the amount you sent; you do not pay extra on top.",
        "If a job does not happen after you sent the money, and the worker did not do the work, the held money comes back to you.",
      ],
    },
    {
      heading: "Proof of work",
      body: [
        "When the worker starts, the app asks the worker for proof before the work: a photo, a video, or a recording. When the worker marks the job done, it asks for proof after the work.",
        "You can see the proof on your job. Only the two people on the job can see it. If a Problem is reported, Jackwork can also look at the proof to help settle the job.",
      ],
    },
    {
      heading: "Confirming a job is done",
      body: [
        "The worker marks the job done first. Then you check the work and confirm it is done. Confirm only when the work is truly done and done the way you agreed.",
        "Do not confirm a job that is not done, and do not refuse to confirm a job that is truly done. Both break these terms.",
        "If you do nothing for a long time after the worker marks the job done, and nobody pressed Problem, the job can finish by itself so the worker is not kept waiting. If the work is not done, press Problem before that time passes.",
        "After the job is done, you can rate the worker, and the worker can rate you. Rate fairly and honestly. Do not rate to punish or to cheat.",
      ],
    },
    {
      heading: "The Problem button",
      body: [
        "From the price step onward, you can press Problem if something is wrong: the worker did not come, the work is bad or not finished, or anything else is not right.",
        "Pressing Problem stops the job from finishing by itself and holds the money where it is. Jackwork can look at the job, including the chat and the proof, to help settle it.",
        "Use Problem honestly, and use it in time. Money that was already released after you confirmed a job is done cannot be pulled back by pressing Problem later.",
      ],
    },
    {
      heading: "Staying safe",
      body: [
        "Talk in the app first. Keep your talk and your pay inside Jackwork, where there is a record.",
        "Do not share your Mobile Money PIN with anyone, including anyone who says they work for Jackwork. Jackwork will never ask for your PIN.",
        "Jackwork checks profiles with ID, keeps ratings, and can look at jobs when a Problem is reported, but Jackwork cannot guarantee how any person will behave. Use your own judgment.",
      ],
    },
    {
      heading: "What is not allowed",
      body: [
        "Lying about who you are, or using another person's ID.",
        "Fake jobs, or describing a job falsely so a worker travels for nothing.",
        "Asking a worker to take pay outside the app, or paying hand to hand for a Jackwork job.",
        "Refusing to confirm work that is truly done, or holding a worker's pay as a threat.",
        "Harassing, threatening, or cheating any person.",
        "Posting jobs that are against the law.",
      ],
    },
    {
      heading: "Closed accounts",
      body: [
        "If you break these rules, Jackwork can close your account, and you will not be able to use Jackwork with that number again.",
        "If your account is closed while a job is open, Jackwork will settle that job in a fair way, including holding, paying, or returning money based on the work truly done.",
      ],
    },
    {
      heading: "Jackwork's responsibility",
      body: [
        "Jackwork provides the marketplace, holds job money as these terms say, and helps settle problems it can see. Jackwork is not responsible for the quality of any worker's work, for injuries, or for loss that comes from a job between two people.",
        "If the app or the Mobile Money network fails during a payment, Jackwork will fix the record so the money follows these terms: held while the work is done, paid to the worker when you confirm the job is done, or returned to you when the job does not happen.",
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
    "Your phone number is never shown to other people in Jackwork. You talk by chat and calls inside the app.",
    "Chat messages on a job are kept with the job. If a Problem is reported, Jackwork can read the chat to help.",
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
        "Which terms you agreed to, Worker or User, and when you agreed.",
        "Your Mobile Money number, when you add it.",
        "Your profile picture, and a photo of your ID.",
        "Your jobs: what the job is, the amount, the day and time, and the place.",
        "Chat messages you send on a job. They are kept with the job.",
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
        "When a worker accepts your job, that worker sees how to get to your house. Your phone number is not shown to the worker, and the worker's phone number is not shown to you. The two of you talk inside Jackwork, by chat messages and calls in the app, and neither side ever sees the other side's number.",
        "Chat messages stay with the job. If a Problem is reported on the job, Jackwork admin can read the chat to help settle it.",
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
