import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fileToBase64 } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";
import { PLACE_COMMUNITIES, PLACE_COUNTIES, PLACE_DISTRICTS, PLACE_TOWNS } from "./places";
// @ts-ignore bundled Meta map control, no type declarations ship with it
import "./hatch-maps.js";
import "./hatch-maps.css";
// @ts-ignore bundled map helpers, no type declarations ship with them
import { mapsDirectionsUrl } from "./map_helpers.mjs";

type Job = ApiResponse<typeof api, "listJobs">["jobs"][number];
type MyProfile = NonNullable<ApiResponse<typeof api, "getMyProfile">["profile"]>;

/* The one number people call for Call in. Set it here when the
   call center opens; empty means no number is set yet, and the
   Call in screen then shows only the short not-available detail,
   no number area. When a number is set, the big number and Call
   button appear with that same detail. */
const CALL_IN_NUMBER: string = "";

/* The picked state, everywhere in the app: a smooth, soothing
   deep red fill with white text and a soft red glow, instead of
   the old white/light fill. Used by the calendar day, the time
   taps, picked answers, the currency pick, and picked categories. */
const selectStyle = (on: boolean): CSSProperties =>
  on
    ? { background: "var(--select)", color: "var(--select-ink)", borderColor: "var(--select)", boxShadow: "var(--select-glow)" }
    : {};

/* ================================================================
   ONE THING PER SCREEN, FULL SCREEN.
   Every screen shows exactly the one thing the person is working
   on. No step labels, no helper paragraphs, no dashboard. The app
   fills the whole screen on phone and computer.
   ================================================================ */

/* ---------- services: kind of work, then service, then the exact job ----------
   The catalog is the one the owner supplied for Liberia, broken down
   into specific jobs written the way people actually say their
   problem ("my toilet is blocked", not "plumbing service"). Kinds of
   work are in the owner's top-demand order first: Cleaning, Handyman,
   Plumbing, Electrical, Moving & Delivery, Mechanic Services,
   Generator, Beauty, Tutoring, Construction, then the rest. The
   detail lives in these lists: more options to pick from, never more
   screens to walk through. TO ADD MORE LATER: add one line to a
   service's `tasks`, or one service to a group. It appears in
   posting, in search, and in Find work categories automatically. */
type Svc = { name: string; icon: string; keys: string; tasks: string[] };
const SERVICE_GROUPS: { name: string; icon: string; services: Svc[] }[] = [
  {
    name: "Cleaning", icon: "sparkles",
    services: [
      { name: "House cleaning", icon: "sparkles", keys: "clean house home maid sweep mop dirt housecleaning", tasks: ["Sweep + mop house", "Clean 1 room", "Clean the whole house", "Deep clean the whole house", "Clean fridge / stove", "Clean after moving out", "Move-in cleaning", "Move-out cleaning", "Home organization — arrange the house"] },
      { name: "Deep cleaning", icon: "sparkles", keys: "deep clean party dirty scrub", tasks: ["Deep clean after party", "Deep clean the kitchen", "Deep clean the bathroom", "Deep clean before people come", "Clean a new house before moving in"] },
      { name: "Laundry and ironing", icon: "washer", keys: "wash clothes iron laundry bag", tasks: ["Wash + iron clothes (per bag)", "Wash clothes only", "Iron clothes only", "Wash blankets and curtains", "Wash school uniforms", "Wash bedsheets and towels"] },
      { name: "Dish washing", icon: "droplet", keys: "wash dishes plates event pots", tasks: ["Wash dishes for event", "Wash dishes at home", "Wash big pots and cooking things"] },
      { name: "Carpet and windows", icon: "sparkles", keys: "carpet window glass clean porch", tasks: ["Carpet cleaning", "Window cleaning", "Wash the porch and yard", "Clean the shop windows"] },
      { name: "Office cleaning", icon: "house", keys: "office shop clean daily weekly school church", tasks: ["Office cleaning (daily)", "Office cleaning (weekly)", "Clean a shop", "Clean a school or church"] },
    ],
  },
  {
    name: "Handyman", icon: "hammer",
    services: [
      { name: "Furniture assembly", icon: "toolbox", keys: "assemble furniture bed wardrobe put together", tasks: ["Assemble a bed", "Assemble a wardrobe", "Assemble a table or chairs", "Assemble a shelf or cabinet", "Take furniture apart"] },
      { name: "Door repairs", icon: "hammer", keys: "door hinge handle close broken", tasks: ["Fix a door that will not close", "Fix a door hinge", "Fix a broken door handle", "Put in a new door", "Fix a sliding door"] },
      { name: "Locks", icon: "shield", keys: "lock key install change locked out", tasks: ["Lock installation", "Change the door lock", "Fix a broken lock", "Locked out — open my door", "Put in a padlock or gate lock"] },
      { name: "Mounting and installing", icon: "hammer", keys: "mount tv curtain hang fan mirror blinds", tasks: ["TV mounting", "Curtain installation", "Ceiling fan installation", "Hang pictures or a mirror", "Install blinds"] },
      { name: "Small repairs", icon: "wrench", keys: "minor repairs fix small things shelf", tasks: ["Shelf installation", "Minor home repairs", "Fix a cabinet or shelf", "Fix a window latch", "Fix a broken chair or table"] },
    ],
  },
  {
    name: "Plumbing", icon: "droplet",
    services: [
      { name: "Pipes and leaks", icon: "droplet", keys: "pipe leak water drip burst plumber", tasks: ["Fix leaking pipe", "Fix a broken pipe under the ground", "Fix a leaking tap", "Stop a water leak", "Fix the pipe to the tank"] },
      { name: "Toilet", icon: "droplet", keys: "toilet blocked unblock flush install commode", tasks: ["Unblock toilet", "Install new toilet", "Fix toilet — will not flush", "Fix toilet leaking at the base"] },
      { name: "Sink and drain", icon: "droplet", keys: "sink drain blocked faucet tap kitchen", tasks: ["Unblock kitchen sink / drain", "Install sink / faucet", "Drain cleaning", "Unblock bathroom drain", "Fix the kitchen tap"] },
      { name: "Water tank and pump", icon: "droplet", keys: "tank pump water pressure black tank leaking", tasks: ["Install water tank (black tank)", "Install water pump", "Water pump repairs", "Fix low water pressure", "Fix water tank leaking", "Clean water tank"] },
      { name: "Shower and bathroom", icon: "droplet", keys: "shower bathroom fix install", tasks: ["Fix shower", "Install a new shower", "Fix the bathroom tap", "Fix bathroom water leak"] },
    ],
  },
  {
    name: "Electrical", icon: "bolt",
    services: [
      { name: "Lights", icon: "bolt", keys: "light fixture chandelier not working electrician", tasks: ["Fix light not working", "Install chandelier / light fixture", "Light fixture installation", "Fix lights going off and on", "Put in new lights"] },
      { name: "Sockets and switches", icon: "bolt", keys: "socket switch outlet replace spark", tasks: ["Replace socket / switch", "Fix a socket or switch", "Put in new sockets", "Fix a sparking socket"] },
      { name: "Wiring", icon: "bolt", keys: "wiring rewire breaker wire pole meter lec current", tasks: ["Electrical wiring", "Rewire 1 room", "Fix the wiring", "Fix the breaker box", "Fix the wire from the pole or meter", "Electrical troubleshooting"] },
      { name: "Solar and inverter", icon: "bolt", keys: "solar panel inverter battery power", tasks: ["Install solar panel (1 panel)", "Install solar panel (full house)", "Install inverter + battery", "Inverter installation", "Fix the inverter or battery", "Connect solar power"] },
      { name: "Generator wiring", icon: "generator", keys: "generator wiring changeover house", tasks: ["Fix generator wiring", "Generator wiring for the house", "Put in a changeover switch"] },
    ],
  },
  {
    name: "Moving & Delivery", icon: "truck",
    services: [
      { name: "Moving help", icon: "package", keys: "move moving house room carry load furniture", tasks: ["Move 1 room (kekeh + 2 guys)", "Move full house", "Move office", "Carry fridge / freezer", "Load a truck", "Unload a truck", "Pack things in boxes", "Move furniture"] },
      { name: "Truck hire", icon: "truck", keys: "truck pickup hire sand gravel", tasks: ["Hire a truck", "Hire a pickup", "Deliver sand or gravel", "Carry building materials", "Carry farm produce"] },
      { name: "Package and food delivery", icon: "bag", keys: "deliver package food courier monrovia delivery", tasks: ["Deliver package across Monrovia", "Deliver a package", "Deliver food from restaurant", "Food delivery", "Business courier services"] },
      { name: "Market and pharmacy runs", icon: "bag", keys: "market groceries pharmacy medicine buy deliver", tasks: ["Buy + deliver groceries from market", "Grocery delivery", "Buy + deliver medicine from pharmacy", "Pharmacy pickup", "Go to the market for me"] },
      { name: "Airport and trips", icon: "car", keys: "airport pickup drop trip", tasks: ["Airport pickup / drop-off", "Pick up someone at the airport", "Drop someone at the airport"] },
    ],
  },
  {
    name: "Mechanic Services", icon: "car",
    services: [
      { name: "Car mechanic", icon: "wrench", keys: "car engine mechanic fix garage brakes", tasks: ["Fix car not starting", "Fix the engine", "Fix the brakes", "Fix brake pads squeaking", "Fix car AC not cold", "Fix overheating or the radiator", "Fix the gearbox", "Fix the clutch", "Check the whole car"] },
      { name: "Oil, tires and battery", icon: "battery", keys: "oil tire tyre battery change flat jump", tasks: ["Change engine oil + filter", "Oil changes", "Fix flat tire / replace tire", "Tire replacement", "Replace car battery", "Battery installation", "Jump start car battery", "Charge the battery"] },
      { name: "Car wash", icon: "carwash", keys: "wash car clean detailing vacuum", tasks: ["Car wash at home (outside only)", "Full car wash + vacuum inside", "Wash the car inside and out", "Mobile detailing", "Clean the car seats", "Wash a motorbike or keke"] },
      { name: "Motorbike and keke", icon: "wrench", keys: "bike motorbike keke tricycle engine", tasks: ["Keke repair (engine)", "Keke will not start", "Moto repair (bike)", "Bike will not start", "Fix the bike chain", "Fix the bike brakes", "Wash keke / moto"] },
      { name: "Driver", icon: "car", keys: "driver drive day trip hire", tasks: ["Driver for a day (you provide car)", "Driver for a trip (Monrovia to Buchanan etc.)", "Drive me to one place", "Truck driver for hire", "Drive for a wedding or funeral"] },
      { name: "Towing", icon: "tow", keys: "tow stuck pull car broken", tasks: ["Tow my car", "Car stuck / need tow", "Pull my car out", "Move a broken car"] },
    ],
  },
  {
    name: "Generator", icon: "generator",
    services: [
      { name: "Generator repair", icon: "generator", keys: "generator repair wont start dead smoking carburetor kva gen", tasks: ["Generator won't start", "Generator repair (small 2.5kva - 5kva)", "Generator repair (big 10kva+)", "Generator carburetor cleaning", "Generator smoking too much", "Generator starts, then stops", "Generator leaking fuel"] },
      { name: "Generator service", icon: "generator", keys: "generator service oil change maintain", tasks: ["Generator service / oil change", "Change the oil and filter", "Service the generator", "Fix the battery or starter"] },
      { name: "Generator install", icon: "generator", keys: "generator install changeover switch automatic", tasks: ["Install automatic changeover switch", "Put in a generator", "Install a generator"] },
      { name: "Generator fuel", icon: "droplet", keys: "generator fuel diesel gasoline deliver", tasks: ["Buy + deliver generator fuel", "Deliver fuel or diesel"] },
    ],
  },
  {
    name: "Beauty", icon: "scissors",
    services: [
      { name: "Hair", icon: "scissors", keys: "hair braids weave wig style salon", tasks: ["Braids (knotless, cornrows, etc.)", "Fix my wig / install wig", "Weave hair", "Style hair for an event", "Dreadlocks", "Color or dye hair", "Fix or remove a weave"] },
      { name: "Barber", icon: "scissors", keys: "haircut barber shave beard trim", tasks: ["Haircut at home", "Cut hair", "Shave / beard trim", "Cut a child's hair"] },
      { name: "Makeup and nails", icon: "sparkles", keys: "makeup nails wedding lashes beauty", tasks: ["Makeup for wedding / party", "Makeup artists", "Manicure + pedicure at home", "Do nails", "Fix lashes or brows"] },
      { name: "Massage and spa", icon: "heart", keys: "massage spa relax body", tasks: ["Massage (30 min)", "Massage (1 hour)", "Massage therapists", "Spa services"] },
    ],
  },
  {
    name: "Tutoring", icon: "laptop",
    services: [
      { name: "School tutoring", icon: "laptop", keys: "tutor waec math english school exam homework lessons", tasks: ["Tutor for WAEC (Math)", "Tutor for WAEC (English)", "Tutor for primary school (all subjects)", "Exam preparation coaching", "Help with school homework", "Home tutoring"] },
      { name: "Reading and languages", icon: "laptop", keys: "read language french spanish teach", tasks: ["Teach kid to read (1 hour)", "Teach reading and writing", "Language lessons", "Teach French / Spanish"] },
      { name: "Computer and phone lessons", icon: "phone", keys: "computer phone whatsapp teach basics online", tasks: ["Teach computer basics (1 hour)", "Computer training", "Teach how to use phone / WhatsApp (for old ma)", "Online tutoring"] },
      { name: "Music and driving lessons", icon: "car", keys: "music piano drum driving lesson", tasks: ["Music lesson (piano / drum)", "Music lessons", "Teach driving (manual / automatic)"] },
    ],
  },
  {
    name: "Construction", icon: "bricks",
    services: [
      { name: "Masonry", icon: "bricks", keys: "masonry blocks plaster wall build mason", tasks: ["Lay 100 blocks", "Build a wall", "Plaster 1 room wall", "Plaster a wall", "Fix cracks in the wall", "Lay blocks"] },
      { name: "Tiles and finishing", icon: "bricks", keys: "tiles ceiling finishing bathroom kitchen floor", tasks: ["Install tiles (bathroom / kitchen floor)", "Put in tiles", "Install ceiling (PVC / plaster)", "Interior finishing"] },
      { name: "Painting", icon: "roller", keys: "paint room house walls color painter", tasks: ["Paint 1 room (you buy paint)", "Paint full house (you buy paint)", "Paint doors and windows", "Paint the outside walls", "Paint a fence or gate"] },
      { name: "Roofing", icon: "house", keys: "roof zinc leaking sheet", tasks: ["Fix leaking roof (zinc)", "Replace zinc roof sheet", "Fix the roof leaks", "Fix the roof frame"] },
      { name: "Carpentry and welding", icon: "hammer", keys: "carpentry welding gate wardrobe fence wood zinc carpenter welder", tasks: ["Build wardrobe / cabinet", "Make a table or chairs", "Weld gate / burglar bar", "Make burglar bars", "Build fence (wood / zinc)", "Fencing installation", "Make a bed frame", "Make a wooden gate"] },
      { name: "Septic and digging", icon: "bricks", keys: "septic soakaway dig pit well", tasks: ["Dig septic tank / soakaway", "Dig a septic tank", "Empty a septic tank", "Dig a pit latrine", "Dig a well"] },
    ],
  },
  {
    name: "Need It NOW", icon: "flag",
    services: [
      { name: "Emergency help", icon: "flag", keys: "now emergency urgent quick fast today", tasks: ["Toilet blocked NOW", "No water NOW", "Generator dead NOW", "Door lock broken / locked out", "Car stuck / need tow", "Snake in house / yard", "Need security guard tonight", "Need nurse to come home"] },
    ],
  },
  {
    name: "Appliances", icon: "fridge",
    services: [
      { name: "Fridge and freezer", icon: "fridge", keys: "fridge freezer cooling ice", tasks: ["Fix fridge not cooling", "Fix freezer making ice too much", "Fix the fridge", "Fix the freezer"] },
      { name: "Air conditioning", icon: "fridge", keys: "ac air conditioning cold leaking gas split", tasks: ["Fix AC not cold / leaking water", "Install AC (split unit)", "Service AC (clean + gas)", "Fix the AC"] },
      { name: "Fans, stove and machines", icon: "washer", keys: "fan stove microwave washing machine spinning hot plate", tasks: ["Fix standing fan not spinning", "Fix washing machine not spinning", "Fix electric stove / hot plate", "Fix microwave", "Fix the iron or kettle", "Fix the blender or small machine"] },
    ],
  },
  {
    name: "Children & Care", icon: "heart",
    services: [
      { name: "Childcare", icon: "smiley", keys: "baby child children babysitter nanny watch kids", tasks: ["Babysitter for 3 hours", "Babysitter for full day", "Watch my child at home", "Watch children for the day", "Take my child to school and back", "Help with homework", "Watch my child at night"] },
      { name: "Care for old or sick", icon: "heart", keys: "old sick care nurse home ma pa", tasks: ["Take care of old ma / pa for a day", "Care at home in the day", "Care at home day and night", "Help with bathing and moving", "Sit with a sick person at the hospital", "Give medicine on time and help the person eat"] },
      { name: "Maid and house help", icon: "house", keys: "maid domestic house help staff", tasks: ["Maid for a day (8 hours)", "Maid for a week (live-out)", "Maid services", "Domestic staff recruitment", "Cook for a week (meal prep)"] },
      { name: "Cooking for people", icon: "cloche", keys: "cook party catering wedding funeral food bake", tasks: ["Cook for party (20 people)", "Cook for my home", "Cook for a wedding", "Cook for a funeral", "Bake bread or cake"] },
      { name: "House sitting and pets", icon: "heart", keys: "house sitting pet dog feed travel watch animal", tasks: ["House-sitter while you travel", "House-sitting", "Wash dog / pet", "Feed pet while you travel", "Watch my dog", "Feed my animals"] },
    ],
  },
  {
    name: "Tech", icon: "phone",
    services: [
      { name: "Phone repair", icon: "phone", keys: "phone screen cracked unlock battery charge speaker", tasks: ["Fix cracked phone screen", "Unlock phone", "Phone will not charge", "Phone will not turn on", "Change the phone battery", "Fix the speaker or mic", "The phone fell in water", "Remove a phone password or lock"] },
      { name: "Computer repair", icon: "laptop", keys: "computer laptop virus turning on setup", tasks: ["Fix laptop not turning on", "Fix the laptop", "Computer will not turn on", "Remove a virus", "Laptop setup", "Install programs", "IT support"] },
      { name: "WiFi and network", icon: "laptop", keys: "wifi internet router network setup", tasks: ["Setup WiFi router", "Wi-Fi setup", "Put in WiFi at my house", "Fix my internet", "Network installation", "Set up a new phone"] },
      { name: "CCTV and TV", icon: "camera", keys: "cctv camera tv dish satellite decoder security", tasks: ["Install CCTV (1 camera)", "Install CCTV (4 cameras)", "CCTV installation", "Fix security cameras", "Put in a satellite dish", "Fix the TV", "Fix the decoder"] },
      { name: "Printer", icon: "laptop", keys: "printer installation fix print", tasks: ["Printer installation", "Fix the printer", "Set up a new computer"] },
    ],
  },
  {
    name: "Business", icon: "bag",
    services: [
      { name: "Design and photos", icon: "camera", keys: "design flyer business card graphic photos shop whatsapp catalog", tasks: ["Design flyer / business card", "Graphic design", "Take product photos for my shop", "Create WhatsApp Business catalog"] },
      { name: "Social media and marketing", icon: "phone", keys: "social media instagram tiktok marketing flyers", tasks: ["Manage my Instagram / TikTok for a week", "Social media management", "Marketing assistance", "Deliver flyers around Monrovia"] },
      { name: "Office help", icon: "laptop", keys: "type print document data entry bookkeeping virtual assistant admin", tasks: ["Type + print document", "Data entry", "Virtual assistant", "Administrative support", "Do my bookkeeping for month", "Bookkeeping"] },
      { name: "Business setup", icon: "bag", keys: "business registration cac setup pos receipt printer", tasks: ["Help with CAC business registration", "Business registration support", "Set up POS / receipt printer"] },
    ],
  },
  {
    name: "Errands & Personal", icon: "package",
    services: [
      { name: "Errands", icon: "bag", keys: "errand line bank lec immigration market carry duala queue", tasks: ["Stand in line for me (bank, LEC, immigration)", "Go to market and buy list for me", "Help me carry load from Duala market", "Run an errand for me", "Pay a bill or do a bank errand", "Pick up something for me"] },
      { name: "Personal assistant", icon: "package", keys: "personal assistant shopping help organize", tasks: ["Personal assistant", "Shopping assistance", "Personal assistant for the day"] },
      { name: "Fitness", icon: "heart", keys: "fitness training exercise personal trainer", tasks: ["Personal fitness training", "Fitness training at home"] },
    ],
  },
  {
    name: "Events", icon: "flag",
    services: [
      { name: "Canopy, chairs and setup", icon: "flag", keys: "rent canopy chairs tables setup event hire", tasks: ["Rent + setup canopy + chairs (50 chairs)", "Hire chairs", "Hire canopies", "Hire tables", "Hire a sound system", "Set up chairs and canopies"] },
      { name: "Decoration", icon: "sparkles", keys: "decorate birthday wedding party event", tasks: ["Decorate for birthday party", "Decorate for wedding", "Event decoration", "Decorate for a party"] },
      { name: "Music and hosting", icon: "flag", keys: "dj mc host music sound event", tasks: ["DJ for 4 hours", "DJ services", "MC for event", "MC / host services", "DJ or sound system"] },
      { name: "Photo and video", icon: "camera", keys: "photographer videographer photo video event", tasks: ["Photographer for 3 hours", "Photography", "Videographer for event", "Videography", "Take photos or video"] },
      { name: "Event food and cleanup", icon: "cloche", keys: "caterer cook serve cleanup party event planning", tasks: ["Cook + serve for event (caterer)", "Catering", "Serve food at an event", "Cleanup after party (2 people)", "Clean after an event", "Event planning"] },
      { name: "Event security", icon: "shield", keys: "security event guards gate", tasks: ["Security for event (2 guards)", "Event security", "Welcome guests at the gate"] },
    ],
  },
  {
    name: "Security", icon: "shield",
    services: [
      { name: "Guards", icon: "shield", keys: "guard security house shop watch", tasks: ["Security guards", "Guard my house", "Guard my shop in the day", "Guard building materials", "Guard a warehouse or yard"] },
      { name: "Night watch", icon: "shield", keys: "night watchman watch night property", tasks: ["Night watchmen", "Watch my shop at night", "Property watch services", "Night watchman for my house"] },
    ],
  },
  {
    name: "Yard & Farm", icon: "leaf",
    services: [
      { name: "Yard work", icon: "leaf", keys: "grass cut bush yard tree compound clear", tasks: ["Cut grass / clear bush", "Cut the grass", "Clear the yard", "Cut down tree", "Trim trees and bushes", "Clean the compound", "Level the ground"] },
      { name: "Farm work", icon: "leaf", keys: "farm plant harvest cassava rice land irrigation crops", tasks: ["Plant cassava / rice", "Harvest cassava", "Planting assistance", "Harvesting assistance", "Farm labor", "Land clearing", "Brush or clear farm land", "Irrigation setup", "Carry farm things"] },
      { name: "Animals and poultry", icon: "heart", keys: "chickens poultry livestock goats feed coop pig", tasks: ["Feed chickens / clean coop", "Poultry care", "Livestock care", "Clean the animal place"] },
    ],
  },
  {
    name: "Water", icon: "droplet",
    services: [
      { name: "Water delivery", icon: "droplet", keys: "water deliver tank gallons fill", tasks: ["Deliver water (1 tank / 500 gallons)", "Water delivery", "Deliver water", "Fill my water tank"] },
      { name: "Wells and boreholes", icon: "droplet", keys: "well borehole drill clean water", tasks: ["Clean water well", "Drill borehole check", "Clean water tank", "Water tank cleaning"] },
    ],
  },
  {
    name: "Premium", icon: "toolbox",
    services: [
      { name: "Professionals", icon: "toolbox", keys: "lawyer accountant architect engineer surveyor doctor real estate professional appointment", tasks: ["Lawyer", "Accountant", "Architect", "Engineer", "Surveyor", "Real estate agent", "Doctor — book an appointment only"] },
    ],
  },
  {
    name: "Other work", icon: "toolbox",
    services: [
      { name: "Other", icon: "toolbox", keys: "other something else work help", tasks: ["Something else"] },
    ],
  },
];



type ServiceDef = { name: string; icon: string; group: string; keys: string; tasks: string[] };
const SERVICES: ServiceDef[] = SERVICE_GROUPS.flatMap((g) =>
  g.services.map((s) => ({ name: s.name, icon: s.icon, group: g.name, keys: s.keys, tasks: s.tasks })),
);
function serviceOf(name: string): ServiceDef | undefined {
  return SERVICES.find((s) => s.name === name);
}
/* ---------- the detail questions for each kind of work ----------
   After the person picks the service and the exact job, Post a job
   shows ONE details screen with that work's own short questions as
   tap answers. Nothing on it is required (except Other work, which
   the person says in their own words): the depth is there to pick
   from, never more screens to walk through. The answers become part
   of the job posting, so a worker reading it knows exactly what the
   job is. */
type WorkQ = { q: string; options?: string[]; text?: boolean; required?: boolean; placeholder?: string };
const WORK_QUESTIONS: Record<string, WorkQ[]> = {
  "House cleaning": [
    { q: "How many rooms?", options: ["1 room", "2 rooms", "3 rooms", "4 rooms", "The whole house"] },
    { q: "One time, or again and again?", options: ["One time only", "Every week", "Every two weeks", "Every month"] },
    { q: "Do you have cleaning things and soap?", options: ["Yes, I have them", "No, bring cleaning things", "Not sure"] },
  ],
  "Deep cleaning": [
    { q: "Where?", options: ["The whole house", "Kitchen and bathroom", "One part of the house"] },
    { q: "How dirty is it?", options: ["Very dirty", "Not too dirty"] },
    { q: "Do you have cleaning things and soap?", options: ["Yes, I have them", "No, bring cleaning things", "Not sure"] },
  ],
  "Laundry and ironing": [
    { q: "How much?", options: ["1 bag", "2 bags", "3 or more bags"] },
    { q: "Where?", options: ["Come to my house", "I will bring the clothes"] },
  ],
  "Dish washing": [
    { q: "For what?", options: ["For an event", "For my house"] },
    { q: "How many dishes?", options: ["A small pile", "A medium pile", "A big pile"] },
  ],
  "Carpet and windows": [
    { q: "What should be cleaned?", options: ["Carpet only", "Windows only", "Carpet and windows"] },
    { q: "How big?", options: ["Small", "Medium", "Big"] },
  ],
  "Office cleaning": [
    { q: "How big is the place?", options: ["Small office or shop", "Medium", "Big"] },
    { q: "How often?", options: ["One time only", "Every day", "Every week"] },
  ],
  "Furniture assembly": [
    { q: "How many pieces?", options: ["1 piece", "2 to 3 pieces", "Many pieces"] },
    { q: "Do you have tools?", options: ["Yes, I have tools", "No, bring tools", "Not sure"] },
  ],
  "Door repairs": [
    { q: "Which door?", options: ["Front door", "Room door", "Bathroom door", "Gate"] },
    { q: "What is wrong?", options: ["Will not close", "Handle is broken", "Hinge is broken", "Lock is bad"] },
  ],
  "Locks": [
    { q: "New lock, or fix the old one?", options: ["Put in a new lock", "Fix the old lock", "Change the lock"] },
    { q: "How many locks?", options: ["1 lock", "2 locks", "3 or more locks"] },
  ],
  "Mounting and installing": [
    { q: "Where?", options: ["Inside the house", "Outside"] },
    { q: "What are the walls?", options: ["Block walls", "Wood walls", "Not sure"] },
  ],
  "Small repairs": [
    { q: "How many things?", options: ["1 thing", "2 to 3 things", "Many things"] },
    { q: "Who brings the materials?", options: ["I have them", "The worker brings them", "Not sure"] },
  ],
  "Pipes and leaks": [
    { q: "Where is the leak?", options: ["Kitchen", "Bathroom", "Outside", "Under the ground"] },
    { q: "Is water still running?", options: ["Yes, water is running", "I turned the water off", "Not sure"] },
    { q: "Do you have the parts it needs?", options: ["Yes, I have them", "No, the worker should bring them", "Not sure"] },
  ],
  "Toilet": [
    { q: "What is wrong?", options: ["Blocked", "Will not flush", "Leaking", "Put in a new one"] },
    { q: "If it is blocked, how bad?", options: ["Water still goes down small", "Fully blocked", "Water is coming back up"] },
  ],
  "Sink and drain": [
    { q: "Where?", options: ["Kitchen", "Bathroom", "Outside"] },
    { q: "How bad is it?", options: ["Slow", "Fully blocked", "Water coming back up"] },
  ],
  "Water tank and pump": [
    { q: "How big is the tank?", options: ["Small tank", "500 gallons", "1000 gallons", "I don't know"] },
    { q: "Where will the tank go?", options: ["On the ground", "Up on a stand", "On the roof"] },
  ],
  "Shower and bathroom": [
    { q: "Fix it, or put in a new one?", options: ["Fix it", "Put in a new one"] },
  ],
  "Lights": [
    { q: "How many lights?", options: ["1 light", "2 to 3 lights", "Many lights"] },
    { q: "Where?", options: ["One room", "The whole house", "Outside"] },
  ],
  "Sockets and switches": [
    { q: "How many?", options: ["1", "2 to 3", "Many"] },
    { q: "What happened?", options: ["Stopped working", "Sparking", "Broken", "Put in new ones"] },
  ],
  "Wiring": [
    { q: "How big is the work?", options: ["1 room", "The whole house", "One part of the house"] },
    { q: "Current from where?", options: ["LEC", "Generator", "LEC and generator", "Solar"] },
  ],
  "Solar and inverter": [
    { q: "What should it power?", options: ["Lights and fan only", "TV and fridge too", "The whole house"] },
    { q: "Do you have panels or a battery?", options: ["I have everything", "I have some things", "I have nothing yet"] },
  ],
  "Generator wiring": [
    { q: "What switch?", options: ["Manual switch", "Automatic switch", "Not sure"] },
  ],
  "Moving help": [
    { q: "How far?", options: ["Inside the same town", "To another town"] },
    { q: "Are there stairs to carry things on?", options: ["No stairs", "Yes, there are stairs", "I don't know"] },
    { q: "Do you need a truck?", options: ["Yes, I need a truck", "No, I have a truck", "No truck needed"] },
  ],
  "Truck hire": [
    { q: "What will it carry?", options: ["Sand or gravel", "Building materials", "Furniture and house things", "Farm things", "Other heavy things"] },
    { q: "How far?", options: ["Inside the same town", "To another town"] },
  ],
  "Package and food delivery": [
    { q: "How far?", options: ["Inside Monrovia", "Outside Monrovia", "To another town"] },
    { q: "How big is it?", options: ["Small", "Medium", "Big or heavy"] },
  ],
  "Market and pharmacy runs": [
    { q: "Which market?", options: ["Duala Market", "Waterside", "Red Light", "Paynesville", "Another market"] },
    { q: "Is your list ready?", options: ["Yes, I have a list", "I will say it on the phone"] },
  ],
  "Airport and trips": [
    { q: "Pick up, or drop off?", options: ["Pick up", "Drop off"] },
    { q: "How many people?", options: ["1 to 2 people", "3 to 4 people", "More than 4 people"] },
  ],
  "Car mechanic": [
    { q: "Does the car start?", options: ["Yes, it starts", "No, it does not start"] },
    { q: "Where is the car now?", options: ["At my house", "At my work or shop", "Stuck on the road"] },
    { q: "What kind of car?", options: ["Small car", "Big car or SUV", "Pickup or truck", "I don't know"] },
  ],
  "Oil, tires and battery": [
    { q: "What kind of car?", options: ["Small car", "Big car or SUV", "Pickup or truck", "I don't know"] },
    { q: "Where is the car now?", options: ["At my house", "At my work or shop", "Stuck on the road"] },
  ],
  "Car wash": [
    { q: "Where?", options: ["At my house", "At the car wash place"] },
    { q: "Do you have water there?", options: ["Yes, I have water", "Bring water", "Not sure"] },
  ],
  "Motorbike and keke": [
    { q: "What is it?", options: ["Motorbike", "Keke", "Tricycle"] },
    { q: "Does it start?", options: ["Yes, it starts", "No, it does not start"] },
    { q: "What is wrong?", options: ["It will not start", "Engine problem", "Brakes", "The chain", "Just check the whole thing"] },
  ],
  "Driver": [
    { q: "For how long?", options: ["A few hours", "The whole day", "Many days"] },
    { q: "Where to?", options: ["Inside the same town", "To another town", "Many places"] },
  ],
  "Towing": [
    { q: "What vehicle?", options: ["Small car", "Big car or SUV", "Pickup or truck", "Motorbike"] },
    { q: "How far?", options: ["Inside the same town", "To another town"] },
  ],
  "Generator repair": [
    { q: "Does it start at all?", options: ["Yes, it starts", "No, it does not start"] },
    { q: "How big is it?", options: ["Small (2.5kva - 5kva)", "Big (10kva+)", "I don't know"] },
    { q: "What fuel does it use?", options: ["Gasoline", "Diesel", "I don't know"] },
  ],
  "Generator service": [
    { q: "How big is it?", options: ["Small generator", "Medium generator", "Big generator", "I don't know"] },
    { q: "When was it last serviced?", options: ["Not long ago", "Long time ago", "Never", "Not sure"] },
  ],
  "Generator install": [
    { q: "Where?", options: ["At my house", "At my shop or office"] },
    { q: "What switch?", options: ["Automatic changeover", "Manual switch", "Not sure"] },
  ],
  "Generator fuel": [
    { q: "How much fuel?", options: ["5 gallons", "10 gallons", "25 gallons", "A full drum"] },
    { q: "What fuel?", options: ["Gasoline", "Diesel"] },
  ],
  "Hair": [
    { q: "Where?", options: ["At my house", "At the salon or shop"] },
    { q: "Do you have the hair or extensions?", options: ["Yes, I have them", "No, bring hair", "Not sure"] },
  ],
  "Barber": [
    { q: "Where?", options: ["At my house", "At the barber shop"] },
  ],
  "Makeup and nails": [
    { q: "For what?", options: ["A wedding", "A party or event", "Photos", "Just for me"] },
    { q: "How many people?", options: ["Just me", "2 to 3 people", "Many people"] },
  ],
  "Massage and spa": [
    { q: "Where?", options: ["At my house", "At the spa"] },
  ],
  "School tutoring": [
    { q: "Who is learning?", options: ["A primary school child", "A junior high student", "A senior high student", "A WAEC student"] },
    { q: "Where?", options: ["At my house", "By phone or online"] },
    { q: "How often?", options: ["One time", "Every week", "Every day"] },
  ],
  "Reading and languages": [
    { q: "Who is learning?", options: ["A child", "A grown person"] },
    { q: "Where?", options: ["At my house", "By phone or online"] },
  ],
  "Computer and phone lessons": [
    { q: "Who is learning?", options: ["A child", "A grown person", "An old person"] },
    { q: "Where?", options: ["At my house", "By phone or online"] },
  ],
  "Music and driving lessons": [
    { q: "Who is learning?", options: ["A child", "A grown person"] },
  ],
  "Masonry": [
    { q: "How big is the job?", options: ["Small job", "Medium job", "Big job"] },
    { q: "Do you have blocks and cement?", options: ["Yes, I have them", "No, the worker should bring them", "Not sure"] },
  ],
  "Tiles and finishing": [
    { q: "Where?", options: ["Bathroom", "Kitchen", "Living room", "The whole house"] },
    { q: "Do you have the tiles?", options: ["Yes, I have tiles", "No, the worker should bring tiles", "Not sure"] },
  ],
  "Painting": [
    { q: "Who brings the paint?", options: ["I have the paint", "The worker should bring paint", "Not sure"] },
    { q: "Do the walls need fixing first?", options: ["Yes, scrape and fill the walls first", "No, just paint"] },
  ],
  "Roofing": [
    { q: "How bad is it?", options: ["Small leak", "Big leak", "The whole roof"] },
    { q: "Do you have zinc sheets?", options: ["Yes, I have zinc", "No, the worker should bring zinc", "Not sure"] },
  ],
  "Carpentry and welding": [
    { q: "Make a new one, or fix the old one?", options: ["Make a new one", "Fix the old one"] },
    { q: "Who brings the wood or metal?", options: ["I have the materials", "The worker should bring them", "Not sure"] },
  ],
  "Septic and digging": [
    { q: "Dig a new one, or work on the old one?", options: ["Dig a new one", "Empty the old one", "Fix the old one"] },
    { q: "How big?", options: ["Small", "Medium", "Big"] },
  ],
  "Emergency help": [
    { q: "Where are you?", options: ["At my house", "At my shop or office", "On the road"] },
  ],
  "Fridge and freezer": [
    { q: "What is wrong with it?", options: ["It is not cooling", "Too much ice", "It makes a bad sound", "It will not turn on", "It is leaking"] },
  ],
  "Air conditioning": [
    { q: "What is wrong with it?", options: ["Not cold", "Leaking water", "Will not turn on", "Just service it"] },
    { q: "How many ACs?", options: ["1 AC", "2 ACs", "3 or more ACs"] },
  ],
  "Fans, stove and machines": [
    { q: "Does it turn on?", options: ["Yes, it turns on", "No, it does not turn on"] },
    { q: "What is wrong with it?", options: ["It works badly", "It makes a bad sound", "It stopped completely"] },
  ],
  "Childcare": [
    { q: "How many children?", options: ["1 child", "2 children", "3 or more children"] },
    { q: "What ages?", options: ["Baby, under 2 years", "2 to 5 years", "6 to 12 years", "Teen"] },
    { q: "Where will you watch them?", options: ["At my house", "At your house", "At school"] },
  ],
  "Care for old or sick": [
    { q: "Where?", options: ["At home", "At the hospital"] },
    { q: "For how long?", options: ["In the day only", "Day and night", "A few hours"] },
  ],
  "Maid and house help": [
    { q: "For how long?", options: ["One day", "One week", "A long time"] },
    { q: "Live in, or come and go?", options: ["Come and go every day", "Stay at the house"] },
  ],
  "Cooking for people": [
    { q: "For how many people?", options: ["My family only", "About 20 people", "About 50 people", "More than 50 people"] },
    { q: "Who brings the food things?", options: ["I have them", "The cook should buy them", "We will talk about it"] },
    { q: "Where will the cooking happen?", options: ["At my house", "At the event place", "Cook and bring the food"] },
  ],
  "House sitting and pets": [
    { q: "For how long?", options: ["A few hours", "The whole day", "Many days"] },
    { q: "What animal?", options: ["A dog", "A cat", "Goats or chickens", "No animal, the house only"] },
  ],
  "Phone repair": [
    { q: "Does the phone turn on?", options: ["Yes, it turns on", "No, it does not turn on"] },
    { q: "Did it fall in water?", options: ["Yes, it fell in water", "No water"] },
  ],
  "Computer repair": [
    { q: "What is it?", options: ["Laptop", "Desktop computer", "Printer"] },
    { q: "Does it turn on?", options: ["Yes, it turns on", "No, it does not turn on"] },
  ],
  "WiFi and network": [
    { q: "New one, or fix the one you have?", options: ["Put in a new one", "Fix the one I have", "Set up a phone or router"] },
  ],
  "CCTV and TV": [
    { q: "What do you need?", options: ["Cameras", "TV or dish", "Both"] },
    { q: "How many cameras?", options: ["1 camera", "2 to 4 cameras", "More than 4 cameras"] },
  ],
  "Design and photos": [
    { q: "How do you want to get it?", options: ["Send it to my phone", "Print it for me", "Both"] },
  ],
  "Social media and marketing": [
    { q: "Which one?", options: ["Instagram", "TikTok", "Facebook", "All of them"] },
  ],
  "Office help": [
    { q: "How much work?", options: ["Small work", "One day of work", "Many days of work"] },
  ],
  "Errands": [
    { q: "How far?", options: ["Inside the same town", "To another town"] },
    { q: "Is everything ready for the errand?", options: ["Yes, all ready", "I will explain on the phone"] },
  ],
  "Personal assistant": [
    { q: "For how long?", options: ["A few hours", "The whole day", "Many days"] },
  ],
  "Fitness": [
    { q: "Where?", options: ["At my house", "Outside or at a gym"] },
  ],
  "Canopy, chairs and setup": [
    { q: "For what event?", options: ["Birthday", "Wedding", "Funeral", "Church program", "Another party"] },
    { q: "How many chairs?", options: ["About 20 chairs", "About 50 chairs", "About 100 chairs", "More than 100 chairs"] },
  ],
  "Decoration": [
    { q: "For what event?", options: ["Birthday", "Wedding", "Funeral", "Another party"] },
  ],
  "Music and hosting": [
    { q: "For how long?", options: ["2 hours", "4 hours", "The whole event"] },
  ],
  "Photo and video": [
    { q: "For how long?", options: ["1 hour", "3 hours", "The whole event"] },
  ],
  "Event food and cleanup": [
    { q: "How many people are coming?", options: ["About 20 people", "About 50 people", "About 100 people", "More than 100 people"] },
  ],
  "Event security": [
    { q: "How many guards?", options: ["1 guard", "2 guards", "3 or more guards"] },
  ],
  "Guards": [
    { q: "Where?", options: ["A house", "A shop", "An event", "A building site"] },
    { q: "For how long?", options: ["One night", "Every night", "Day and night"] },
  ],
  "Night watch": [
    { q: "Where?", options: ["A house", "A shop", "A yard or warehouse"] },
  ],
  "Yard work": [
    { q: "How big is the yard?", options: ["Small yard", "Medium yard", "Big yard or farm"] },
    { q: "Who brings the tools?", options: ["I have tools", "The worker should bring tools"] },
  ],
  "Farm work": [
    { q: "How big is the land?", options: ["A small piece", "A medium piece", "Big land"] },
    { q: "Who brings the tools?", options: ["I have tools", "The worker should bring them", "Not sure"] },
  ],
  "Animals and poultry": [
    { q: "What animal?", options: ["Chickens", "Goats", "Pigs", "Other animals"] },
    { q: "For how long?", options: ["One day", "Every day", "Many days"] },
  ],
  "Water delivery": [
    { q: "How much water?", options: ["A little", "500 gallons", "1 full tank", "More than 1 tank"] },
  ],
  "Wells and boreholes": [
    { q: "What is the water like now?", options: ["Small water", "No water at all", "The well is dirty"] },
  ],
  "Professionals": [
    { q: "How do you want to meet?", options: ["At their office", "At my house", "By phone"] },
  ],
  "Other": [
    { q: "Say in your own words exactly what you need", text: true, required: true, placeholder: "Write what you need" },
    { q: "How big is the job?", options: ["Small job", "Medium job", "Big job"] },
  ],
};
const GENERIC_QUESTIONS: WorkQ[] = [
  { q: "How big is the job?", options: ["Small job", "Medium job", "Big job"] },
  { q: "Do you have the things the work needs?", options: ["Yes, I have them", "No, the worker should bring them", "Not sure"] },
];
function questionsFor(serviceName: string): WorkQ[] {
  return WORK_QUESTIONS[serviceName] ?? GENERIC_QUESTIONS;
}

/* ---------- fuzzy search: spelling does not have to be right ---------- */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array<number>(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m]![n]!;
}
/* Light stemming, so the words people use for a problem match the
   job words: "blocked" finds "Unblock", "leaking" finds "leak". */
function stemWord(w: string): string {
  let s = w;
  if (s.length > 4 && s.startsWith("un")) s = s.slice(2);
  if (s.length > 4 && s.startsWith("re")) s = s.slice(2);
  if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith("ed")) s = s.slice(0, -2);
  else if (s.length > 4 && s.endsWith("es")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s")) s = s.slice(0, -1);
  return s;
}
function wordMatches(word: string, targetWords: string[]): boolean {
  if (!word) return true;
  const sw = stemWord(word);
  return targetWords.some((t) => {
    if (t === word || t.startsWith(word) || word.startsWith(t)) return true;
    const st = stemWord(t);
    if (st === sw || (sw.length >= 3 && st.startsWith(sw)) || (st.length >= 3 && sw.startsWith(st))) return true;
    const tol = word.length <= 3 ? 0 : word.length <= 5 ? 1 : 2;
    return tol > 0 && editDistance(word, t) <= tol;
  });
}
type SearchHit = { service: ServiceDef; task: string | null };
function searchServices(query: string): SearchHit[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const qWords = q.split(" ").filter(Boolean);
  const hits: { hit: SearchHit; score: number }[] = [];
  for (const s of SERVICES) {
    const svcWords = norm(`${s.name} ${s.keys} ${s.group}`).split(" ");
    const svcOk = qWords.every((w) => wordMatches(w, svcWords));
    if (svcOk) hits.push({ hit: { service: s, task: null }, score: 2 });
    for (const t of s.tasks) {
      const taskWords = norm(`${t} ${s.name} ${s.keys}`).split(" ");
      if (qWords.every((w) => wordMatches(w, taskWords))) {
        hits.push({ hit: { service: s, task: t }, score: t.toLowerCase().includes(q) ? 0 : 1 });
      }
    }
  }
  hits.sort((a, b) => a.score - b.score);
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of hits) {
    const k = `${h.hit.service.name}|${h.hit.task ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h.hit);
    if (out.length >= 14) break;
  }
  return out;
}

/* ---------- Liberia places live in ./places.ts ----------
   The place database is the real file now: every county, district,
   town, and Greater Monrovia community a person can pick is a real
   record from the sourced data in places.ts (see its header for
   the sources and counts). There is no hand-written town list and
   no generated community names anywhere in the app: if a name is
   not in places.ts, it cannot be picked. The place picker
   further down walks that data level by level. */

const ID_TYPES = ["National ID", "Voter ID", "Passport", "Driver license", "Work ID", "School ID", "Other ID"];

/** Big picture icons for low-literacy use. One entry per icon key. */
const ICONS: Record<string, ReactNode> = {
  car: (<><path d="M5 11l1.6-4.6A2 2 0 0 1 8.5 5h7a2 2 0 0 1 1.9 1.4L19 11" /><rect x="3" y="11" width="18" height="5.5" rx="1" /><circle cx="7.5" cy="18" r="1.7" /><circle cx="16.5" cy="18" r="1.7" /></>),
  wrench: (<path d="M14.7 6.3a4.6 4.6 0 0 0-6.1 6.1L3 18l3 3 5.6-5.6a4.6 4.6 0 0 0 6.1-6.1L14 13l-3-3 3.7-3.7z" />),
  tire: (<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.2" /><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" /></>),
  tow: (<><rect x="2" y="7" width="10" height="9" /><path d="M12 10h3.5L19 13v3h-7" /><circle cx="6.5" cy="18" r="1.7" /><circle cx="15.5" cy="18" r="1.7" /><path d="M19 3v4M17 5h4" /></>),
  battery: (<><rect x="2" y="8" width="17" height="9" rx="1.5" /><path d="M22 11.5v2" /><path d="M12.5 9.8 9.8 12.8h2.3l-1.4 3 4-3.6h-2.4l1.2-2.4z" fill="currentColor" stroke="none" /></>),
  carwash: (<><path d="M11 4s5.5 6 5.5 10a5.5 5.5 0 0 1-11 0C5.5 10 11 4 11 4z" /><circle cx="19" cy="5" r="1.6" /><circle cx="5.5" cy="3.5" r="1.1" /></>),
  house: (<><path d="M3 11l9-8 9 8" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /></>),
  droplet: (<><path d="M12 3s6.5 7 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z" /><path d="M9.2 14.2a3 3 0 0 0 2.8 3" /></>),
  bolt: (<path d="M13 2 4.8 13.4h6L9.6 22 19 10.2h-6.2L13 2z" />),
  hammer: (<><path d="M14.5 3.5 20.5 9.5 18 12l-6-6z" /><path d="M12.5 9.5 4 18l2 2 8.5-8.5" /></>),
  roller: (<><rect x="3" y="3" width="13" height="5" rx="1" /><path d="M16 5.5h3.5a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H13v2.5" /><rect x="11" y="14.5" width="4" height="6.5" rx="1" /></>),
  sparkles: (<><path d="M11 4l1.6 4.9L17.5 10.5l-4.9 1.6L11 17l-1.6-4.9L4.5 10.5l4.9-1.6z" /><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>),
  fridge: (<><rect x="6" y="2.5" width="12" height="19" rx="1.5" /><path d="M6 10h12" /><path d="M9 5.5v2M9 13v3" /></>),
  toolbox: (<><rect x="3" y="10" width="18" height="9" rx="1.5" /><path d="M9 10V7.5a3 3 0 0 1 6 0V10" /><path d="M3 14.5h18" /></>),
  bricks: (<><rect x="3" y="5" width="18" height="14" /><path d="M3 12h18M9 5v7M15 5v7M12 12v7" /></>),
  generator: (<><rect x="3" y="7" width="18" height="11" rx="1.5" /><circle cx="9" cy="12.5" r="2.3" /><path d="M15 10.3h4M15 14.7h4" /></>),
  smiley: (<><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14s1.2 2 3.5 2 3.5-2 3.5-2" /><path d="M9 9.5h.01M15 9.5h.01" strokeWidth="3" /></>),
  heart: (<path d="M12 20.5S3.8 15.5 3.8 9.8A4.5 4.5 0 0 1 12 7.2a4.5 4.5 0 0 1 8.2 2.6c0 5.7-8.2 10.7-8.2 10.7z" />),
  scissors: (<><circle cx="6" cy="7" r="2.5" /><circle cx="6" cy="17" r="2.5" /><path d="M8.2 8.7 20 16.5M8.2 15.3 20 7.5" /></>),
  shirt: (<path d="M8.5 4 3.5 7l2 3.2L7.5 9v11h9V9l2 1.2 2-3.2-5-3a4.2 4.2 0 0 1-7 0z" />),
  washer: (<><rect x="4.5" y="2.5" width="15" height="19" rx="2" /><circle cx="12" cy="13.5" r="4.3" /><path d="M12 11.5c1.5 1.8 3.5 1.6 4.3 3M7.5 5.8h.01" strokeWidth="2.5" /></>),
  leaf: (<><path d="M5.5 19.5C5.5 11 12 4.5 20 4.5c0 8-5.5 15-14.5 15z" /><path d="M5.5 19.5c3-5.5 7-9.5 11-11.5" /></>),
  package: (<><path d="M12 3.5 20 7.5v9L12 20.5 4 16.5v-9z" /><path d="M4 7.5 12 11.5 20 7.5M12 11.5v9" /></>),
  shield: (<path d="M12 22s8-3.6 8-10V5.2L12 2.5 4 5.2V12c0 6.4 8 10 8 10z" />),
  bug: (<><ellipse cx="12" cy="13.5" rx="4.3" ry="5.8" /><path d="M12 7.7V4.5M8 10.5 4.5 8M8 16.5 4.5 19M16 10.5 19.5 8M16 16.5l3.5 2.5" /></>),
  cloche: (<><path d="M4.5 16.5a7.5 7.5 0 0 1 15 0" /><path d="M2.5 20h19M2.5 16.5h19" /><circle cx="12" cy="6.8" r="1.1" /><path d="M12 7.9v1.1" /></>),
  flag: (<><path d="M5.5 21.5v-17" /><path d="M5.5 4.5H18L15 8.5l3 4H5.5" /></>),
  bag: (<><path d="M3 8.5h4M2.5 12.5H7M3 16.5h4" /><rect x="10.5" y="6.5" width="10" height="12" rx="1.5" /><path d="M13.5 6.5a2.3 2.3 0 0 1 4.5 0" /></>),
  truck: (<><rect x="2" y="6.5" width="11" height="9.5" /><path d="M13 10h3.8L20.5 13.5V16H13" /><circle cx="6.5" cy="18" r="1.7" /><circle cx="16.5" cy="18" r="1.7" /></>),
  phone: (<><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" strokeWidth="2.5" /></>),
  laptop: (<><rect x="4.5" y="5" width="15" height="10.5" rx="1.5" /><path d="M2.5 19.5h19" /></>),
  camera: (<><path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>),
};

function ServiceIcon({ icon, size = 30, color }: { icon: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[icon] ?? ICONS.toolbox}
    </svg>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (a + b).toUpperCase();
}
function digits(s: string): string {
  return s.replace(/\D/g, "");
}
function samePhone(a: string, b: string): boolean {
  const da = digits(a);
  const db = digits(b);
  if (!da || !db) return false;
  return da === db || da.endsWith(db.slice(-7)) || db.endsWith(da.slice(-7));
}
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
/* The coordinates a profile or job uses for distance: the ones
   saved from the real place record it picked. Rows saved before
   the real place data loaded have none, so they are matched by
   name against the real records (exact town or community match,
   in the same county when the county is known) and use that
   record's coordinates; a row that matches nothing gets no
   distance and falls back to the town/district/county labels,
   never a crash and never a made-up number. Defined further down
   with the place index; hoisting covers the use here. */
function profilePlaceCoords(profile: MyProfile | null): { lat: number; lng: number } | null {
  if (!profile) return null;
  if (profile.placeLat != null && profile.placeLng != null) return { lat: profile.placeLat, lng: profile.placeLng };
  if (profile.gpsLat != null && profile.gpsLng != null) return { lat: profile.gpsLat, lng: profile.gpsLng };
  return resolveSavedPlaceCoords({
    county: profile.county,
    city: profile.city,
    community: profile.community ?? (profile.address ? profile.address : null),
  });
}
function placeDistanceKm(job: Job, profile: MyProfile | null): number | null {
  const mine = profilePlaceCoords(profile);
  if (!mine) return null;
  const jobCoords =
    job.placeLat != null && job.placeLng != null
      ? { lat: job.placeLat, lng: job.placeLng }
      : job.gpsLat != null && job.gpsLng != null
        ? { lat: job.gpsLat, lng: job.gpsLng }
        : null;
  if (!jobCoords) return null;
  return haversineKm(mine.lat, mine.lng, jobCoords.lat, jobCoords.lng);
}
function distanceLabel(job: Job, profile: MyProfile | null): string | null {
  const d = placeDistanceKm(job, profile);
  if (d == null) return null;
  if (d < 1) return "Less than 1 km away";
  return `${Math.round(d)} km away`;
}
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
function money(job: Job): string | null {
  if (job.budgetAmount == null) return null;
  const sym = job.budgetCurrency === "LRD" ? "LD " : "$";
  return `${sym}${job.budgetAmount.toLocaleString()} · ${job.budgetType}`;
}
function statusLabel(s: string): string {
  switch (s) {
    case "open": return "Open";
    case "accepted": return "Accepted";
    case "in_progress": return "Work started";
    case "completed": return "Done";
    case "cancelled": return "Cancelled";
    default: return s;
  }
}
function homeLocationWords(p: { city: string | null; county: string | null; location: string; address: string }): string {
  if (p.city && p.county) return `${p.city}, ${p.county}`;
  return p.location;
}

/* ---------- scheduling: one exact day + one exact time ----------
   No vague stretches of time ("today", "this week", "next week").
   The person picks ONE real coming day and ONE exact time on it.
   Days are stored as YYYY-MM-DD and times as "9:00 AM", so the job
   shows the exact moment everywhere: "Friday, Nov 14 at 9:00 AM". */
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function parseDateKey(key: string): Date | null {
  const parts = key.split("-").map(Number);
  const [y = 0, m = 0, d = 0] = parts;
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function dayLabel(key: string): string {
  const d = parseDateKey(key);
  if (!d) return key;
  return `${DAY_NAMES[d.getDay()] ?? ""}, ${MONTH_NAMES[d.getMonth()] ?? ""} ${d.getDate()}`;
}
/** The picked day in full words for the big confirmation lines:
    "Saturday, November 14". */
function dayLabelFull(key: string): string {
  const d = parseDateKey(key);
  if (!d) return key;
  return `${DAY_NAMES[d.getDay()] ?? ""}, ${MONTH_NAMES_FULL[d.getMonth()] ?? ""} ${d.getDate()}`;
}
/** How far ahead the calendar lets a person book: today plus
    about 3 months. Keeps the picking simple and near. */
function maxScheduleDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
}
function slotDateTime(dateKey: string, time: string): Date | null {
  const d = parseDateKey(dateKey);
  if (!d) return null;
  const m = /^(\d{1,2}):(\d{2})\s(AM|PM)$/.exec(time.trim());
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  if (m[3] === "PM" && hour !== 12) hour += 12;
  if (m[3] === "AM" && hour === 12) hour = 0;
  d.setHours(hour, minute, 0, 0);
  return d;
}
function isFutureSlot(dateKey: string, time: string): boolean {
  const dt = slotDateTime(dateKey, time);
  return dt != null && dt.getTime() > Date.now();
}
/** The exact moment a job is scheduled for, in words. Emergency
    (Need It NOW) jobs have no day/time: they mean right now. */
function scheduleLabel(job: { scheduledDate: string | null; scheduledTime: string | null; urgency: string }): string {
  if (job.scheduledDate && job.scheduledTime) return `${dayLabel(job.scheduledDate)} at ${job.scheduledTime}`;
  return job.urgency;
}

/* ---------- small icons ---------- */
function I({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const PinIcon = () => <I d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />;
const PhoneIcon = () => <I d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.34 1.79.66 2.64a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.44-1.23a2 2 0 0 1 2.11-.45c.85.32 1.74.54 2.64.66A2 2 0 0 1 22 16.92z" />;
const ShieldIcon = () => <I d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Z M9 11.5l2 2 4-4.5" />;
const BackIcon = () => <I d="M19 12H5 M11 6l-6 6 6 6" />;
const CheckIcon = () => <I d="M20 6 9 17l-5-5" size={22} />;
const ChevronIcon = () => <I d="m9 6 6 6-6 6" />;

/* ---------- shared bits ---------- */
function Avatar({ name, photoUrl, size = 44 }: { name: string; photoUrl?: string | null; size?: number }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" className="shrink-0 object-cover" style={{ width: size, height: size, borderRadius: 12 }} aria-hidden="true" />;
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, borderRadius: 12, background: "var(--text)", color: "var(--bg)", fontWeight: 800, fontSize: size * 0.36, fontFamily: "var(--font-display)" }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

function Stars({ value, onPick }: { value: number; onPick?: (n: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-1" role={onPick ? "radiogroup" : undefined} aria-label={onPick ? "Your rating" : `Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const star = (
          <svg width="40" height="40" viewBox="0 0 24 24" fill={filled ? "var(--yellow)" : "none"} stroke={filled ? "var(--text)" : "var(--dim)"} strokeWidth="1.6" aria-hidden="true">
            <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
          </svg>
        );
        return onPick ? (
          <button key={n} type="button" aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`} onClick={() => onPick(n)} className="p-1.5">
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    open: { bg: "var(--yellow)", fg: "var(--yellow-ink)" },
    accepted: { bg: "var(--surface2)", fg: "var(--text)" },
    in_progress: { bg: "var(--surface2)", fg: "var(--text)" },
    completed: { bg: "var(--text)", fg: "var(--bg)" },
    cancelled: { bg: "var(--surface2)", fg: "var(--dim)" },
  };
  const s = map[status] ?? map.open;
  return (
    <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold" style={{ borderRadius: 12, background: s?.bg, color: s?.fg }}>
      {statusLabel(status)}
    </span>
  );
}

function VerifiedBadge({ status }: { status: string }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-extrabold" style={{ color: "var(--accent)" }}>
        <ShieldIcon /> ID verified
      </span>
    );
  }
  if (status === "pending") return <span className="text-sm font-bold" style={{ color: "var(--dim)" }}>ID check pending</span>;
  return <span className="text-sm font-bold" style={{ color: "var(--dim)" }}>No ID yet</span>;
}

function StatusSteps({ status }: { status: string }) {
  if (status === "cancelled") return null;
  const steps = ["Posted", "Accepted", "Working", "Done"];
  const idx = status === "open" ? 0 : status === "accepted" ? 1 : status === "in_progress" ? 2 : 3;
  return (
    <div className="flex items-center gap-1" aria-label={`Job status: ${steps[idx]}`}>
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-1">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-black" style={{ borderRadius: 12, background: i <= idx ? "var(--text)" : "var(--surface2)", color: i <= idx ? "var(--bg)" : "var(--dim)", fontFamily: "var(--font-display)" }} aria-hidden="true">
            {i + 1}
          </span>
          <span className="text-[11px] font-bold" style={{ color: i <= idx ? "var(--text)" : "var(--dim)" }}>{label}</span>
          {i < steps.length - 1 && <span className="h-0.5 flex-1" style={{ background: i < idx ? "var(--text)" : "var(--border)" }} aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}

function ProfileScore({ profileId, role }: { profileId: number; role: "worker" | "customer" }) {
  const q = useQuery({
    queryKey: ["profile-stats", profileId],
    queryFn: () => api.getProfileStats({ profileId }),
  });
  if (!q.data) return null;
  if (role === "worker") {
    if (q.data.jobsDone === 0) return <span className="text-sm text-[var(--dim)]">New worker</span>;
    return (
      <span className="text-sm font-bold text-[var(--text)]">
        {q.data.jobsDone} job{q.data.jobsDone === 1 ? "" : "s"} done{q.data.workerAvg != null ? ` · Rated ${q.data.workerAvg} of 5` : ""}
      </span>
    );
  }
  if (q.data.jobsPosted === 0) return null;
  return (
    <span className="text-sm font-bold text-[var(--text)]">
      {q.data.jobsPosted} job{q.data.jobsPosted === 1 ? "" : "s"} posted{q.data.customerAvg != null ? ` · Rated ${q.data.customerAvg} of 5` : ""}
    </span>
  );
}

/* ---------- screen shell ----------
   One-question screens (layout="center", the default): the title, the
   one field or choice set, and the Next button form ONE compact group
   that sits in the middle of the screen, up and down as well as side
   to side. The group keeps its natural height: nothing is pinned to
   the far top or the far bottom, and there is no empty stretch in
   the middle. The column is a comfortable width, never stretched
   straight across a wide screen. The back button stays small in the
   top corner of the column and does not pull the group apart.
   List screens (layout="top"): title at the top, then a normal
   top-to-bottom list flow. */
/** The JackWork wordmark from the finished logo: the word alone,
   bold, in the logo's glow red, in the top right corner a little
   down from the top edge — but rendered as part of the BACKGROUND,
   not as print on top of the screen. It sits in the background
   layer (z-0, first in its container, so every glass panel and
   control paints over it), at partial strength, blended into the
   red background washes and softened at the edges (see
   .brand-mark-behind in theme.css), like the word is formed out
   of the glow itself. It is NOT a header or a bar — it never
   blocks a tap and never pushes content. Shown only on the entry
   screens: the three sign-in screens and the signed-in start
   screen. */
function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="brand-mark-behind pointer-events-none absolute right-1 top-4 z-0 select-none text-[22px] font-black leading-none"
      style={{ fontFamily: "var(--font-display)", color: "var(--brand)" }}
    >
      JackWork
    </span>
  );
}

function Screen({
  title,
  onBack,
  layout = "center",
  brand,
  children,
}: {
  title: string;
  onBack?: () => void;
  layout?: "center" | "top";
  brand?: boolean;
  children: ReactNode;
}) {
  const backRow = (
    <div className="flex items-center">
      {onBack ? (
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 py-2 pr-3 text-base font-bold text-[var(--dim)]" aria-label="Go back">
          <BackIcon /> Back
        </button>
      ) : (
        <span />
      )}
    </div>
  );
  if (layout === "top") {
    return (
      <div className="flex w-full flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col">
          {backRow}
          <h1 className="mt-1 text-center text-[30px] font-black leading-tight text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>{title}</h1>
          <div className="mt-6 flex flex-col pb-4 [&>form]:flex [&>form]:flex-col">{children}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex w-full flex-1 flex-col">
      {brand && <BrandMark />}
      <div className="absolute left-0 top-0 z-10">{backRow}</div>
      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center pb-8">
        <h1 className="w-full text-center text-[30px] font-black leading-tight text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>{title}</h1>
        <div className="center-screen mt-5 flex w-full flex-col [&>form]:mx-auto [&>form]:flex [&>form]:w-full [&>form]:max-w-[250px] [&>form]:flex-col">{children}</div>
      </div>
    </div>
  );
}

/** One big full-width glass choice. */
function BigChoice({
  title,
  sub,
  icon,
  primary,
  badge,
  onClick,
  ariaLabel,
}: {
  title: string;
  sub?: string;
  icon?: ReactNode;
  primary?: boolean;
  badge?: string;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? title}
      className={`flex w-full flex-col items-center justify-center gap-2 p-5 text-center active:opacity-80 ${primary ? "" : "glass"}`}
      style={{
        borderRadius: 12,
        minHeight: 88,
        background: primary ? "var(--yellow)" : undefined,
        color: primary ? "var(--yellow-ink)" : "var(--text)",
      }}
    >
      {icon && (
        <span className="flex shrink-0 items-center justify-center" style={{ width: 56, height: 56, borderRadius: 12, background: primary ? "var(--yellow-ink)" : "var(--text)", color: primary ? "var(--yellow)" : "var(--bg)" }} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="flex items-center justify-center gap-2">
        <span className="text-xl font-black leading-tight" style={{ fontFamily: "var(--font-display)" }}>{title}</span>
        {badge && (
          <span className="flex h-7 min-w-7 shrink-0 items-center justify-center px-1.5 text-sm font-black" style={{ background: "var(--text)", color: "var(--bg)", borderRadius: 12 }} aria-label={badge}>
            {badge}
          </span>
        )}
      </span>
      {sub && <span className="block text-sm font-semibold" style={{ color: primary ? "var(--yellow-ink)" : "var(--dim)", opacity: primary ? 0.75 : 1 }}>{sub}</span>}
    </button>
  );
}

const bigInputCls = "field";
const primaryBtnStyle = { background: "var(--yellow)", color: "var(--yellow-ink)", borderRadius: 12, fontFamily: "var(--font-display)" } as const;
const darkBtnStyle = { background: "var(--text)", color: "var(--bg)", borderRadius: 12, fontFamily: "var(--font-display)" } as const;
const glassBtnStyle = { borderRadius: 12, fontFamily: "var(--font-display)" } as const;

/** One tappable row in a pick list (county, district, town, task...).
    A row the person already picked fills with the red selection
    highlight, like every other picked state in the app. */
function PickRow({ label, sub, icon, onClick, ariaLabel, selected }: { label: string; sub?: string; icon?: ReactNode; onClick: () => void; ariaLabel?: string; selected?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className="glass flex w-full items-center gap-3 px-5 py-4 text-left active:opacity-80"
      style={{ borderRadius: 12, minHeight: 64, ...selectStyle(!!selected) }}
    >
      {icon && <span className="shrink-0" style={{ color: selected ? "var(--select-ink)" : "var(--text)" }} aria-hidden="true">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: selected ? "var(--select-ink)" : "var(--text)" }}>{label}</span>
        {sub && <span className="block text-sm font-semibold" style={{ color: selected ? "var(--select-ink)" : "var(--dim)", opacity: selected ? 0.85 : 1 }}>{sub}</span>}
      </span>
      <span style={{ color: selected ? "var(--select-ink)" : "var(--dim)" }} aria-hidden="true"><ChevronIcon /></span>
    </button>
  );
}

/** The facts of ONE job, nothing else. */
function JobFacts({ job, profile, customerPhotoUrl, workerPhotoUrl, showHouse }: { job: Job; profile: MyProfile | null; customerPhotoUrl?: string | null; workerPhotoUrl?: string | null; showHouse?: boolean }) {
  const price = money(job);
  const dist = distanceLabel(job, profile);
  const near = (() => {
    if (!profile) return null;
    const [cityPart = "", countyPart = ""] = job.location.split(",");
    const poster: PlaceFields = { county: countyPart.trim() || null, district: null, city: cityPart.trim() || null, community: job.landmark ?? null };
    return areaLabel(poster, placeOf(profile));
  })();
  const callNumber = job.contactPhone ?? job.customerPhone;
  return (
    <div className="glass p-5" style={{ borderRadius: 12 }}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-extrabold uppercase tracking-wide" style={{ background: "var(--text)", color: "var(--bg)", borderRadius: 12 }}>
          <ServiceIcon icon={serviceOf(job.category)?.icon ?? "toolbox"} size={15} color="var(--bg)" />
          {job.category}
        </span>
        <StatusPill status={job.status} />
      </div>
      <h2 className="mt-3 text-2xl font-black leading-snug text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>{job.title}</h2>
      <p className="mt-1.5 text-base leading-relaxed text-[var(--dim)]">{job.description}</p>
      <div className="mt-4 grid gap-2 text-base font-semibold text-[var(--text)]">
        <span className="inline-flex items-center gap-2"><PinIcon />{job.location}{job.landmark ? ` · ${job.landmark}` : ""}</span>
        {dist && (
          <span>
            <span className="inline-flex items-center px-2.5 py-1 text-sm font-black" style={{ background: "var(--text)", color: "var(--bg)", borderRadius: 12 }}>{dist}</span>
          </span>
        )}
        {near && (
          <span>
            <span className="inline-flex items-center px-2.5 py-1 text-sm font-black" style={{ background: "var(--text)", color: "var(--bg)", borderRadius: 12 }}>{near}</span>
          </span>
        )}
        <span>When: {scheduleLabel(job)}</span>
        <span className="text-sm text-[var(--dim)]">Posted {timeAgo(job.createdAt)}</span>
        {callNumber.trim() && (
          <span className="inline-flex items-center gap-2"><PhoneIcon /> Call: {callNumber}</span>
        )}
        {showHouse && job.houseDirections && (
          <span className="inline-flex items-start gap-2"><PinIcon /> House: {job.houseDirections}</span>
        )}
        <span className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)" }}>{price ?? "Price agreed by phone"} · Pay by {job.payMethod}</span>
      </div>
      {job.gpsLat != null && job.gpsLng != null && (() => {
        const url = mapsDirectionsUrl({ label: job.title, lat: job.gpsLat, lng: job.gpsLng }) as string | null;
        return url ? (
          <a href={url} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-1.5 font-extrabold underline underline-offset-2" aria-label={`Open directions to the job pin for ${job.title}`}>
            <PinIcon /> Job pin, get directions
          </a>
        ) : null;
      })()}
      <div className="mt-4 flex items-center gap-3 border-t border-[var(--border)] pt-4">
        <Avatar name={job.customerName} photoUrl={customerPhotoUrl} size={44} />
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-[var(--text)]">{job.customerName}</p>
          <p className="text-sm text-[var(--dim)]">Posted this job</p>
          {job.customerProfileId != null && <ProfileScore profileId={job.customerProfileId} role="customer" />}
        </div>
      </div>
      {job.providerName && (
        <div className="mt-3 flex items-center gap-3">
          <Avatar name={job.providerName} photoUrl={workerPhotoUrl} size={44} />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-[var(--text)]">{job.providerName}</p>
            <p className="text-sm text-[var(--dim)]">Worker on this job</p>
            {job.providerId != null && <ProfileScore profileId={job.providerId} role="worker" />}
          </div>
        </div>
      )}
      {(job.status === "accepted" || job.status === "in_progress" || job.status === "completed") && (
        <div className="mt-4">
          <StatusSteps status={job.status} />
        </div>
      )}
      {job.status === "completed" && job.rating != null && (
        <div className="mt-4 bg-[var(--surface2)] p-3" style={{ borderRadius: 12 }}>
          <p className="text-sm font-bold text-[var(--text)]">Customer rating: {job.rating} of 5</p>
          {job.review && <p className="mt-1 text-sm text-[var(--text)]">“{job.review}”</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- pick a place: county, district, town, community ----------
   The address at sign-up is picked step by step, one level per
   screen, the normal way: first the county, then the district
   inside it, then the town inside that, then the community when
   the town has real ones. Every screen shows its level's FULL
   list from the real place data in places.ts, with a search box
   at the top that filters only that level's list as the person
   types; scrolling the full list and searching both work. There
   is no single global place search and no blank field for a
   place: the saved place is always the full real record the
   person tapped, with its coordinates. Then the one short house
   description. Used at sign-up and in Profile. */
export type PickedPlace = { county: string; district: string; city: string; community: string | null; house: string; lat: number | null; lng: number | null };

/* One pickable place: a real record from places.ts. A town pick
   carries the town's surveyed coordinates. A community pick
   carries its town's coordinates, because the community sources
   name the communities but the pick is held exactly like the
   Greater Monrovia ones, on the town's surveyed point; the two
   community towns with no surveyed point at all (Garwolon,
   Johnsonville) keep null coordinates and simply get no
   distance, never an invented one. */
type PlaceEntry = { county: string; district: string; city: string; community: string | null; lat: number | null; lng: number | null };

const TOWN_ENTRY_BY_KEY = new Map<string, PlaceEntry>();
const PLACE_ENTRIES: PlaceEntry[] = [];
for (const t of PLACE_TOWNS) {
  const d = PLACE_DISTRICTS[t[0]]!;
  const county = PLACE_COUNTIES[d[0]]!;
  const e: PlaceEntry = { county, district: d[1], city: t[1], community: null, lat: t[2], lng: t[3] };
  PLACE_ENTRIES.push(e);
  TOWN_ENTRY_BY_KEY.set(`${county}|${d[1]}|${t[1]}`, e);
}
const COMMUNITIES_BY_TOWN = new Map<string, PlaceEntry[]>();
for (const [county, district, town, community] of PLACE_COMMUNITIES) {
  const townEntry = TOWN_ENTRY_BY_KEY.get(`${county}|${district}|${town}`);
  const e: PlaceEntry = { county, district, city: town, community, lat: townEntry?.lat ?? null, lng: townEntry?.lng ?? null };
  PLACE_ENTRIES.push(e);
  const key = `${county}|${district}|${town}`;
  const list = COMMUNITIES_BY_TOWN.get(key) ?? [];
  list.push(e);
  COMMUNITIES_BY_TOWN.set(key, list);
}
function communitiesOfTown(e: PlaceEntry): PlaceEntry[] {
  if (e.community) return [];
  return COMMUNITIES_BY_TOWN.get(`${e.county}|${e.district}|${e.city}`) ?? [];
}

/* Coordinates for a place saved before the real data loaded:
   match its saved words against the real records by exact name —
   the community first, then the town — preferring the same
   county when it is known. No match means no coordinates: the
   place still displays and filters by its saved words, and the
   person can re-pick it from the real list any time in Profile. */
const SAVED_COORDS_CACHE = new Map<string, { lat: number; lng: number } | null>();
function resolveSavedPlaceCoords(saved: { county: string | null; city: string | null; community: string | null }): { lat: number; lng: number } | null {
  const cacheKey = `${saved.county ?? ""}|${saved.city ?? ""}|${saved.community ?? ""}`;
  const cached = SAVED_COORDS_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;
  const comm = saved.community ? norm(saved.community) : "";
  const city = saved.city ? norm(saved.city) : "";
  const county = saved.county ? norm(saved.county) : "";
  let result: { lat: number; lng: number } | null = null;
  if (comm || city) {
    let townHit: PlaceEntry | null = null;
    for (const e of PLACE_ENTRIES) {
      if (county && norm(e.county) !== county) continue;
      if (comm && e.community && norm(e.community) === comm && e.lat != null && e.lng != null) {
        result = { lat: e.lat, lng: e.lng };
        break;
      }
      if (!townHit && city && !e.community && norm(e.city) === city) townHit = e;
    }
    if (!result && townHit && townHit.lat != null && townHit.lng != null) result = { lat: townHit.lat, lng: townHit.lng };
  }
  SAVED_COORDS_CACHE.set(cacheKey, result);
  return result;
}

function PlacePicker({
  initial,
  onDone,
  onBack,
}: {
  initial?: Partial<PickedPlace>;
  onDone: (place: PickedPlace) => void;
  onBack: () => void;
}) {
  const [stage, setStage] = useState<"county" | "district" | "town" | "community" | "house">("county");
  const [countyQ, setCountyQ] = useState("");
  const [districtQ, setDistrictQ] = useState("");
  const [townQ, setTownQ] = useState("");
  const [communityQ, setCommunityQ] = useState("");
  const [county, setCounty] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [town, setTown] = useState<PlaceEntry | null>(null);
  const [picked, setPicked] = useState<PlaceEntry | null>(null);
  const [house, setHouse] = useState(initial?.house ?? "");

  const finish = (e: PlaceEntry, houseText: string) =>
    onDone({ county: e.county, district: e.district, city: e.city, community: e.community, house: houseText, lat: e.lat, lng: e.lng });
  const placeWords = picked ? (picked.community ? `${picked.community}, ${picked.city}` : `${picked.city}, ${picked.county}`) : "";

  /* Each level's list comes only from the level above it, and each
     level's search box filters only its own list. */
  const countyList = useMemo(
    () => PLACE_COUNTIES.filter((c) => norm(c).includes(norm(countyQ))),
    [countyQ],
  );
  const districtList = useMemo(() => {
    if (!county) return [];
    const ci = PLACE_COUNTIES.indexOf(county);
    return PLACE_DISTRICTS
      .filter((d) => d[0] === ci)
      .map((d) => d[1])
      .filter((name) => norm(name).includes(norm(districtQ)))
      .sort((a, b) => a.localeCompare(b));
  }, [county, districtQ]);
  const townList = useMemo(() => {
    if (!county || !district) return [];
    return PLACE_ENTRIES
      .filter((e) => !e.community && e.county === county && e.district === district && norm(e.city).includes(norm(townQ)))
      .sort((a, b) => a.city.localeCompare(b.city));
  }, [county, district, townQ]);
  const townCommunities = useMemo(() => (town ? communitiesOfTown(town) : []), [town]);
  const communityList = useMemo(
    () => townCommunities.filter((e) => norm(e.community ?? "").includes(norm(communityQ))),
    [townCommunities, communityQ],
  );

  const searchBox = (id: string, label: string, value: string, setValue: (v: string) => void) => (
    <div className="relative mx-auto mb-4 w-full max-w-[300px]">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--dim)]" aria-hidden="true">
        <ServiceIcon icon="search" size={22} />
      </span>
      <label className="sr-only" htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(e) => setValue(e.target.value)} placeholder={label} className={bigInputCls} style={{ paddingLeft: "3rem" }} autoComplete="off" />
    </div>
  );
  const noMatch = (
    <p className="py-4 text-center text-base font-semibold text-[var(--dim)]">Nothing matches that search.</p>
  );

  if (stage === "house" && picked) {
    /* The ONLY person-specific part: how to get to your own house,
       in your own words, written once and kept with your place.
       Not an address form, not a map, not a pin. Jobs carry it from
       the profile automatically; the worker sees it on the job
       together with the call number. */
    return (
      <Screen title="How do we get to your house?" onBack={() => setStage(townCommunities.length > 0 ? "community" : "town")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            finish(picked, house.trim());
          }}
        >
          <p className="mb-3 text-center text-base font-semibold text-[var(--dim)]">{placeWords}</p>
          <label className="sr-only" htmlFor="pk-house">How someone gets to your house, in your own words</label>
          <input id="pk-house" value={house} onChange={(e) => setHouse(e.target.value)} placeholder="e.g. When you get to the field, call me" className={bigInputCls} autoComplete="off" />
          <button type="submit" className="mt-5 w-full py-4 text-xl font-black" style={primaryBtnStyle}>
            Save
          </button>
          <button type="button" onClick={() => finish(picked, "")} className="mt-2 w-full py-3 text-center text-base font-bold text-[var(--dim)]" aria-label="Skip, I will explain on the phone">
            Skip
          </button>
        </form>
      </Screen>
    );
  }

  /* Community, ONLY when the picked town has real named
     communities in the data (today the Greater Monrovia towns):
     the town itself first, then its full community list. Towns
     with no communities in any real source never see this screen:
     the town pick already completed the place. */
  if (stage === "community" && town) {
    return (
      <Screen title={town.city} onBack={() => setStage("town")} layout="top">
        {searchBox("pk-community-search", "Search your community", communityQ, setCommunityQ)}
        <div className="flex flex-col gap-2.5">
          <PickRow
            label={town.city}
            sub={`${town.district}, ${town.county}`}
            selected={picked === town}
            onClick={() => { setPicked(town); setStage("house"); }}
            ariaLabel={`Pick ${town.city} itself, no community`}
          />
          {communityList.map((e) => (
            <PickRow
              key={`${e.community}|${e.city}`}
              label={e.community!}
              sub={`${e.city}, ${e.county}`}
              selected={picked === e}
              onClick={() => { setPicked(e); setStage("house"); }}
              ariaLabel={`Pick ${e.community}, ${e.city}, ${e.county}`}
            />
          ))}
          {communityQ.trim() !== "" && communityList.length === 0 && noMatch}
        </div>
      </Screen>
    );
  }

  if (stage === "town" && county && district) {
    return (
      <Screen title="What town or city do you live in?" onBack={() => setStage("district")} layout="top">
        {searchBox("pk-town-search", "Search your town", townQ, setTownQ)}
        <div className="flex flex-col gap-2.5">
          {townList.map((e) => (
            <PickRow
              key={`${e.city}|${e.district}|${e.county}`}
              label={e.city}
              sub={`${e.district}, ${e.county}`}
              selected={town === e}
              onClick={() => {
                setTown(e);
                if (communitiesOfTown(e).length > 0) {
                  setPicked(null);
                  setStage("community");
                } else {
                  setPicked(e);
                  setStage("house");
                }
              }}
              ariaLabel={`Pick ${e.city}, ${e.district}, ${e.county}`}
            />
          ))}
          {townList.length === 0 && noMatch}
        </div>
      </Screen>
    );
  }

  if (stage === "district" && county) {
    return (
      <Screen title="What district do you live in?" onBack={() => setStage("county")} layout="top">
        {searchBox("pk-district-search", "Search your district", districtQ, setDistrictQ)}
        <div className="flex flex-col gap-2.5">
          {districtList.map((name) => (
            <PickRow
              key={name}
              label={name}
              sub={county}
              selected={district === name}
              onClick={() => { setDistrict(name); setTown(null); setPicked(null); setStage("town"); }}
              ariaLabel={`Pick ${name} district, ${county}`}
            />
          ))}
          {districtList.length === 0 && noMatch}
        </div>
      </Screen>
    );
  }

  /* County: the full list of the 15 counties in ABC order,
     scrollable, with its own search box at the top. Montserrado,
     the most used county, is ALSO pinned as the head item at the
     very top of the list, and still appears again in its normal
     ABC position below. Both rows are the same pick. The pin
     shows on the full list; while searching, the search filters
     the whole county list the normal way. */
  return (
    <Screen title="What county do you live in?" onBack={onBack} layout="top">
      {initial?.city && (
        <p className="mb-3 text-center text-base font-semibold text-[var(--dim)]">Now: {initial.community ? `${initial.community}, ` : ""}{initial.city ?? ""}, {initial.county ?? ""}</p>
      )}
      {searchBox("pk-county-search", "Search your county", countyQ, setCountyQ)}
      <div className="flex flex-col gap-2.5">
        {countyQ.trim() === "" && PLACE_COUNTIES.includes("Montserrado") && (
          <PickRow
            key="pinned-Montserrado"
            label="Montserrado"
            selected={county === "Montserrado"}
            onClick={() => { setCounty("Montserrado"); setDistrict(null); setTown(null); setPicked(null); setStage("district"); }}
            ariaLabel="Pick Montserrado county"
          />
        )}
        {countyList.map((c) => (
          <PickRow
            key={c}
            label={c}
            selected={county === c}
            onClick={() => { setCounty(c); setDistrict(null); setTown(null); setPicked(null); setStage("district"); }}
            ariaLabel={`Pick ${c} county`}
          />
        ))}
        {countyList.length === 0 && noMatch}
      </div>
    </Screen>
  );
}


/* ================================================================
   SIGN IN — name, then phone, then code. One thing per screen.
   A new person then says where they live with the stepped
   county, district, town, and community picks, and one short
   house description. The phone number is
   the account and never changes after this.
   ================================================================ */
function SignInFlow({ onDone, onCallIn }: { onDone: (phone: string, sessionToken: string) => void; onCallIn: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [deliveredCode, setDeliveredCode] = useState<string | null>(null);
  const [profileExists, setProfileExists] = useState(true);
  const [newProfileId, setNewProfileId] = useState<number | null>(null);
  const [pendingToken, setPendingToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setError(null);
    if (digits(phone).length < 6) { setError("Enter your phone number."); return; }
    setBusy(true);
    const res = await api.requestSignInCode({ phone: phone.trim() });
    setBusy(false);
    setDeliveredCode(res.deliveredCode);
    setProfileExists(res.profileExists);
    setStep(2);
  }

  async function verifyCode() {
    setError(null);
    if (code.trim().length < 4) { setError("Enter the 4 numbers of your code."); return; }
    setBusy(true);
    const res = await api.verifySignInCode({ phone: phone.trim(), code: code.trim(), name: name.trim() });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "That code did not work."); return; }
    await queryClient.invalidateQueries();
    if (!profileExists && res.profileId) {
      setPendingToken(res.sessionToken ?? "");
      setNewProfileId(res.profileId);
      return;
    }
    onDone(phone.trim(), res.sessionToken ?? "");
  }

  if (newProfileId != null) {
    return (
      <PlacePicker
        onBack={() => setNewProfileId(null)}
        onDone={async (place) => {
          await api.updateHomeLocation({
            profileId: newProfileId,
            county: place.county,
            district: place.district,
            city: place.city,
            community: place.community ?? undefined,
            houseDirections: place.house,
            placeLat: place.lat ?? undefined,
            placeLng: place.lng ?? undefined,
          });
          await queryClient.invalidateQueries();
          onDone(phone.trim(), pendingToken);
        }}
      />
    );
  }

  if (step === 0) {
    return (
      <Screen title="What is your name?" brand>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (name.trim().length < 2) { setError("Enter your name."); return; }
            setStep(1);
          }}
        >
          <label className="sr-only" htmlFor="si-name">Your name</label>
          <input id="si-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="name" className={bigInputCls} />
          {error && <p className="mt-3 text-center text-base font-semibold" style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="submit" className="mt-5 w-full py-4 text-xl font-black" style={primaryBtnStyle}>
            Next
          </button>
        </form>
        <button type="button" onClick={onCallIn} className="mt-4 w-full py-3 text-center text-base font-bold text-[var(--dim)]" aria-label="Call in">
          Call in
        </button>
      </Screen>
    );
  }

  if (step === 1) {
    return (
      <Screen title="What is your phone number?" brand onBack={() => { setStep(0); setError(null); }}>
        <form onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
          <label className="sr-only" htmlFor="si-phone">Your phone number</label>
          <input id="si-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="0770 000 000" autoComplete="tel" className={bigInputCls} />
          {error && <p className="mt-3 text-center text-base font-semibold" style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="submit" disabled={busy} className="mt-5 w-full py-4 text-xl font-black disabled:opacity-50" style={primaryBtnStyle}>
            {busy ? "Sending..." : "Send my code"}
          </button>
        </form>
      </Screen>
    );
  }

  return (
    <Screen title="Type the code" brand onBack={() => { setStep(1); setError(null); setCode(""); }}>
      {deliveredCode && (
        <div className="glass mb-5 p-4 text-center" style={{ borderRadius: 12 }}>
          <p className="text-sm font-semibold text-[var(--dim)]">Your code for {phone}</p>
          <p className="text-4xl font-black tracking-[0.3em] text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>{deliveredCode}</p>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void verifyCode(); }}>
        <label className="sr-only" htmlFor="si-code">Type the code</label>
        <input id="si-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="----" className={`${bigInputCls} mx-auto w-[190px] text-center text-2xl font-black tracking-[0.3em]`} />
        {error && <p className="mt-3 text-center text-base font-semibold" style={{ color: "var(--danger)" }}>{error}</p>}
        <button type="submit" disabled={busy} className="mt-5 w-full py-4 text-xl font-black disabled:opacity-50" style={primaryBtnStyle}>
          {busy ? "Checking..." : "Sign in"}
        </button>
      </form>
      <button type="button" disabled={busy} onClick={sendCode} className="mt-2 w-full py-3 text-center text-base font-bold text-[var(--dim)]" aria-label="Send a new code">
        Send a new code
      </button>
    </Screen>
  );
}

/* ================================================================
   CALL IN — one screen, one thing: a short detail in plain
   words. Call in is not available yet; later a person will
   answer, tell you what to do, or do it for you. The number is
   the single CALL_IN_NUMBER value; while none is set, the
   screen shows only that short detail, no number area. When a
   number is set, the big number and Call button appear above
   the detail, exactly as before.
   ================================================================ */
function CallInScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen title="Call in" onBack={onBack}>
      <div className="flex flex-col items-center text-center">
        {CALL_IN_NUMBER && (
          <div className="flex w-full flex-col items-center" aria-label="Call in number">
            <p className="text-4xl font-black tracking-wide text-[var(--text)]" style={{ fontFamily: "var(--font-display)", minHeight: "3rem" }}>
              {CALL_IN_NUMBER}
            </p>
            <a
              href={`tel:${CALL_IN_NUMBER.replace(/[^+\d]/g, "")}`}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 py-4 text-xl font-black"
              style={primaryBtnStyle}
              aria-label={`Call ${CALL_IN_NUMBER}`}
            >
              <PhoneIcon /> Call
            </a>
          </div>
        )}
        <div className={`glass w-full px-6 py-6 ${CALL_IN_NUMBER ? "mt-8" : ""}`}>
          <p className="text-2xl font-black leading-snug text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>
            Call in is not available yet.
          </p>
          <p className="mt-3 text-xl font-bold leading-snug text-[var(--text)]">
            Later, you will be able to call Jackwork.
          </p>
          <p className="mt-3 text-xl font-bold leading-snug text-[var(--text)]">
            A person will answer, tell you what to do, or do it for you.
          </p>
        </div>
      </div>
    </Screen>
  );
}

/* ================================================================
   POST A JOB — one thing per screen:
   search or pick the kind of work, then the service, then the
   exact job. Then ONE details screen with that work's own short
   questions as tap answers (all optional, all on the one screen).
   Then the number the worker should call, then the exact day and
   the exact time (one screen each, both required; Need It NOW jobs
   skip them because they mean right now), Mobile Money pay
   (Liberian dollars first, then USD), a note if wanted, check it,
   post it. The place is never asked here: the job uses the place
   on the person's profile automatically.
   ================================================================ */
type PostStage =
  | "pick" | "group" | "service" | "ask"
  | "callPhone" | "day" | "time" | "pay" | "note" | "check";

function PostWizard({
  profile,
  onExit,
  onPosted,
}: {
  profile: MyProfile;
  onExit: () => void;
  onPosted: () => void;
}) {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<PostStage>("pick");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [service, setService] = useState<string | null>(null);
  const [task, setTask] = useState<string | null>(null);
  // the work's own detail questions: all on ONE screen, all tap
  // answers, all optional. The answers join the posting.
  const [answers, setAnswers] = useState<string[]>([]);
  // the rest
  const [callPhone, setCallPhone] = useState<string | null>(null);
  // the exact day (YYYY-MM-DD) the person taps on the calendar, and
  // the exact time built from three big taps: the hour (1 to 12),
  // the minutes (:00, :15, :30, :45), and AM or PM. The parts stay
  // null until picked, and posting requires the whole time —
  // except Need It NOW jobs, which mean right now.
  const [schedDate, setSchedDate] = useState<string | null>(null);
  const [schedHour, setSchedHour] = useState<number | null>(null);
  const [schedMinute, setSchedMinute] = useState<number | null>(null);
  const [schedAmpm, setSchedAmpm] = useState<"AM" | "PM" | null>(null);
  // the month the calendar is showing: starts on this month and
  // moves one month at a time with the arrows.
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const schedTime =
    schedHour != null && schedMinute != null && schedAmpm
      ? `${schedHour}:${String(schedMinute).padStart(2, "0")} ${schedAmpm}`
      : null;
  const [mmNumber, setMmNumber] = useState<string | null>(null);
  const [mmBusy, setMmBusy] = useState(false);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  // Liberian dollars first and picked by default, then USD.
  const [currency, setCurrency] = useState<"LRD" | "USD">("LRD");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const activeGroup = SERVICE_GROUPS.find((g) => g.name === group);
  const activeService = service ? serviceOf(service) : undefined;
  const hits = useMemo(() => searchServices(query), [query]);
  const jobLocation = homeLocationWords(profile);
  // The job carries the poster's PICKED community (a fixed list
  // entry, never free text) so it can be matched and filtered by it.
  const jobLandmark = profile.community ?? (profile.address || null);
  const finalCallPhone = (callPhone ?? profile.phone).trim();
  const isEmergency = activeService?.group === "Need It NOW";
  const schedLabel = schedDate && schedTime ? `${dayLabel(schedDate)} at ${schedTime}` : null;
  // The full picked moment is no good if it has already passed
  // (only possible when the picked day is today).
  const schedInPast = schedDate != null && schedTime != null && !isFutureSlot(schedDate, schedTime);

  const workQuestions = service ? questionsFor(service) : [];
  const detailText = workQuestions
    .map((q, i) => (answers[i]?.trim() ? `${q.q} ${answers[i]!.trim()}` : ""))
    .filter(Boolean)
    .join(" · ");

  function setAnswerAt(i: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = next[i] === value ? "" : value;
      return next;
    });
  }

  function setTextAnswerAt(i: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function chooseTask(svc: ServiceDef, t: string | null) {
    setService(svc.name);
    setTask(t);
    setAnswers([]);
    setSchedDate(null);
    setSchedHour(null);
    setSchedMinute(null);
    setSchedAmpm(null);
    const n = new Date();
    setCalMonth({ y: n.getFullYear(), m: n.getMonth() });
    setStage("ask");
  }

  function backFrom(stageNow: PostStage): () => void {
    switch (stageNow) {
      case "pick": return onExit;
      case "group": return () => setStage("pick");
      case "service": return () => setStage("group");
      case "ask": return () => setStage(activeService ? "service" : "pick");
      case "callPhone": return () => setStage("ask");
      case "day": return () => setStage("callPhone");
      case "time": return () => setStage("day");
      case "pay": return () => setStage(isEmergency ? "callPhone" : "time");
      case "note": return () => setStage("pay");
      case "check": return () => setStage("note");
      default: return onExit;
    }
  }

  async function submit() {
    if (!service) return;
    setError(null);
    if (!jobLocation || jobLocation.trim().length < 2) {
      setError("Add where you live in your profile first, then post.");
      return;
    }
    if (digits(finalCallPhone).length < 6) {
      setError("The worker needs a number to call. Go back and check it.");
      return;
    }
    if (!isEmergency) {
      if (!schedDate || !schedTime) {
        setError("Pick the exact day and time first. Go back and pick them.");
        return;
      }
      if (!isFutureSlot(schedDate, schedTime)) {
        setError("That day and time have already passed. Go back and pick a new one.");
        return;
      }
    }
    setBusy(true);
    try {
      const placeCoords = profilePlaceCoords(profile);
      const title = task ?? `${service} needed`;
      const descriptionParts = [
        `${service}${task ? `: ${task}` : ""}.`,
        detailText ? `Details: ${detailText}.` : "",
        note.trim(),
        jobLandmark ? `Community: ${jobLandmark}.` : "",
        profile.houseDirections ? `How to get to the house: ${profile.houseDirections}.` : "",
        isEmergency ? "Needed right now." : schedLabel ? `Come on ${schedLabel}.` : "",
        `In ${jobLocation}. Call ${finalCallPhone}.`,
      ].filter(Boolean);
      await api.createJob({
        title,
        category: service,
        task: task ?? undefined,
        description: descriptionParts.join(" "),
        location: jobLocation,
        landmark: jobLandmark ?? undefined,
        budgetAmount: amount ? Number(amount) : undefined,
        budgetCurrency: currency,
        budgetType: "Negotiable",
        urgency: isEmergency ? "Right now" : (schedLabel ?? "Right now"),
        scheduledDate: !isEmergency && schedDate ? schedDate : undefined,
        scheduledTime: !isEmergency && schedTime ? schedTime : undefined,
        houseDirections: profile.houseDirections ?? undefined,
        payMethod: "Mobile Money",
        customerName: profile.fullName,
        customerPhone: profile.phone,
        contactPhone: finalCallPhone,
        customerProfileId: profile.id,
        // The job carries the coordinates of the place on the
        // poster's profile (from the real place record they
        // picked), so Find work can order by real distance.
        ...(placeCoords ? { placeLat: placeCoords.lat, placeLng: placeCoords.lng } : {}),
      });
      await queryClient.invalidateQueries();
      setDone(true);
    } catch {
      setError("Posting did not go through. Check your connection and tap Post again.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <Screen title="Your job is live">
        <div className="flex flex-col items-center">
          <span className="flex items-center justify-center" style={{ width: 84, height: 84, borderRadius: 12, background: "var(--text)", color: "var(--bg)" }} aria-hidden="true">
            <CheckIcon />
          </span>
          <button type="button" onClick={onPosted} className="mt-8 w-full py-4 text-xl font-black" style={primaryBtnStyle} aria-label="See my jobs">
            See my jobs
          </button>
          <button type="button" onClick={onExit} className="mt-2 w-full py-3 text-center text-base font-bold text-[var(--dim)]" aria-label="Go back to the start">
            Back to the start
          </button>
        </div>
      </Screen>
    );
  }

  /* The price the poster offers, in Liberian dollars (listed
     first and picked by default) or USD. It sits on the Mobile
     Money pay screen; the job then shows its amount in that same
     currency on the board, in My jobs, and on the job screen. */
  const priceBlock = (
    <div className="mt-6">
      <p className="text-center text-base font-bold text-[var(--text)]">Price you offer</p>
      <div className="mt-2 flex justify-center gap-2" role="radiogroup" aria-label="Pick the currency of your price">
        {(["LRD", "USD"] as const).map((c) => {
          const on = currency === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setCurrency(c)}
              className="px-4 py-2.5 text-base font-extrabold"
              style={{
                borderRadius: 12,
                background: on ? "var(--select)" : "var(--glass)",
                color: on ? "var(--select-ink)" : "var(--text)",
                border: "1.5px solid var(--glass-border)",
                fontFamily: "var(--font-display)",
                ...selectStyle(on),
              }}
            >
              {c === "LRD" ? "Liberian dollars (LD)" : "USD"}
            </button>
          );
        })}
      </div>
      <label className="sr-only" htmlFor="pw-amount">Price you offer</label>
      <input
        id="pw-amount"
        type="number"
        min={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={currency === "LRD" ? "e.g. 5000" : "e.g. 50"}
        className={`${bigInputCls} mx-auto mt-3 w-[190px] text-center`}
      />
    </div>
  );

  /* Pick: search first, then the kinds of work. */
  if (stage === "pick") {
    return (
      <Screen title="What do you need?" onBack={backFrom("pick")} layout="top">
        <div className="relative mx-auto w-full max-w-[300px]">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--dim)]" aria-hidden="true">
            <ServiceIcon icon="search" size={22} />
          </span>
          <label className="sr-only" htmlFor="pw-search">Search for the work you need</label>
          <input id="pw-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type what you need" className={bigInputCls} style={{ paddingLeft: "3rem" }} autoComplete="off" />
        </div>
        {query.trim().length >= 2 ? (
          <div className="mt-4 flex flex-col gap-2.5">
            {hits.length === 0 && (
              <p className="py-4 text-center text-base font-semibold text-[var(--dim)]">Nothing found. Try other words, or pick from the list below.</p>
            )}
            {hits.map((h) => (
              <PickRow
                key={`${h.service.name}|${h.task ?? ""}`}
                label={h.task ?? h.service.name}
                sub={h.task ? h.service.name : h.service.group}
                icon={<ServiceIcon icon={h.service.icon} size={26} />}
                onClick={() => chooseTask(h.service, h.task)}
                ariaLabel={`Pick ${h.task ?? h.service.name}`}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SERVICE_GROUPS.map((g) => (
              <button
                key={g.name}
                type="button"
                onClick={() => { setGroup(g.name); setStage("group"); }}
                className="glass flex flex-col items-center justify-center gap-2.5 p-4 text-center active:opacity-80"
                style={{ borderRadius: 12, minHeight: 132 }}
                aria-label={`Pick ${g.name}`}
              >
                <span className="flex items-center justify-center" style={{ width: 60, height: 60, borderRadius: 12, background: "var(--text)", color: "var(--bg)" }} aria-hidden="true">
                  <ServiceIcon icon={g.icon} size={34} color="var(--bg)" />
                </span>
                <span className="text-base font-extrabold leading-tight text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>{g.name}</span>
              </button>
            ))}
          </div>
        )}
      </Screen>
    );
  }

  /* The services in one group. */
  if (stage === "group" && activeGroup) {
    return (
      <Screen title={activeGroup.name} onBack={backFrom("group")} layout="top">
        <div className="flex flex-col gap-2.5">
          {activeGroup.services.map((s) => (
            <PickRow
              key={s.name}
              label={s.name}
              icon={<ServiceIcon icon={s.icon} size={28} />}
              onClick={() => { setService(s.name); setStage("service"); }}
              ariaLabel={`Pick ${s.name}`}
            />
          ))}
        </div>
      </Screen>
    );
  }

  /* The specific jobs for one service. */
  if (stage === "service" && activeService) {
    return (
      <Screen title={activeService.name} onBack={backFrom("service")} layout="top">
        <div className="flex flex-col gap-2.5">
          {activeService.tasks.map((t) => (
            <PickRow key={t} label={t} onClick={() => chooseTask(activeService, t)} ariaLabel={`Pick: ${t}`} />
          ))}
        </div>
      </Screen>
    );
  }

  /* The work's own detail questions, ALL on this one screen.
     Tap the answers that fit, or write in your own words where a
     question asks for that. Nothing here is required except Other
     work's own words, and the whole screen can be skipped: the
     depth is in the choices, not in more screens. */
  if (stage === "ask") {
    const missingRequired = workQuestions.some((q, i) => q.required && !(answers[i] ?? "").trim());
    return (
      <Screen title="More details" onBack={backFrom("ask")} layout="top">
        <div className="flex flex-col gap-6">
          {workQuestions.map((q, i) => (
            <div key={`${q.q}-${i}`}>
              <p className="mb-2 text-center text-lg font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>{q.q}</p>
              {q.options ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {q.options.map((opt) => {
                    const on = answers[i] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswerAt(i, opt)}
                        aria-pressed={on}
                        aria-label={opt}
                        className="px-4 py-2.5 text-base font-bold"
                        style={{
                          borderRadius: 12,
                          background: on ? "var(--select)" : "var(--glass)",
                          color: on ? "var(--select-ink)" : "var(--text)",
                          border: "1.5px solid var(--glass-border)",
                          ...selectStyle(on),
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mx-auto w-full max-w-[300px]">
                  <label className="sr-only" htmlFor={`pw-answer-${i}`}>{q.q}</label>
                  <input
                    id={`pw-answer-${i}`}
                    value={answers[i] ?? ""}
                    onChange={(e) => setTextAnswerAt(i, e.target.value)}
                    placeholder={q.placeholder ?? "Write it in your own words"}
                    className={bigInputCls}
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={missingRequired}
          onClick={() => setStage("callPhone")}
          className="mx-auto mt-8 w-full max-w-[300px] py-4 text-xl font-black disabled:opacity-40"
          style={primaryBtnStyle}
        >
          Next
        </button>
        {!missingRequired && (
          <button
            type="button"
            onClick={() => { setAnswers([]); setStage("callPhone"); }}
            className="mt-2 w-full py-3 text-center text-base font-bold text-[var(--dim)]"
            aria-label="Skip the details"
          >
            Skip
          </button>
        )}
      </Screen>
    );
  }

  /* The number the worker should call. */
  if (stage === "callPhone") {
    return (
      <Screen title="What number should the worker call?" onBack={backFrom("callPhone")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (digits(finalCallPhone).length < 6) { setError("Enter the number to call."); return; }
            setError(null);
            // Need It NOW jobs mean right now: no day and time to pick.
            setStage(isEmergency ? "pay" : "day");
          }}
        >
          <label className="sr-only" htmlFor="pw-call">Number the worker should call</label>
          <input id="pw-call" value={callPhone ?? profile.phone} onChange={(e) => setCallPhone(e.target.value)} inputMode="tel" placeholder="0770 000 000" autoComplete="tel" className={bigInputCls} />
          {error && <p className="mt-3 text-center text-base font-semibold" style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="submit" className="mt-5 w-full py-4 text-xl font-black" style={primaryBtnStyle}>
            Next
          </button>
        </form>
      </Screen>
    );
  }

  /* Pick the exact day on a real calendar: the month and year at
     the top, one arrow each way to move a month, and the person
     taps the one day they want. Days already past cannot be
     tapped, and the calendar stops about 3 months ahead so it
     stays simple. The tapped day is filled in solid, and the day
     in full words sits big under the calendar with the Next
     button — no way past this screen without a day. */
  if (stage === "day") {
    const now = new Date();
    const todayKey = toDateKey(now);
    const maxKey = toDateKey(maxScheduleDate());
    const firstDow = new Date(calMonth.y, calMonth.m, 1).getDay();
    const daysInMonth = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array.from({ length: firstDow }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    const canPrev = calMonth.y > now.getFullYear() || (calMonth.y === now.getFullYear() && calMonth.m > now.getMonth());
    const maxD = maxScheduleDate();
    const canNext = calMonth.y < maxD.getFullYear() || (calMonth.y === maxD.getFullYear() && calMonth.m < maxD.getMonth());
    const moveMonth = (delta: number) => {
      const d = new Date(calMonth.y, calMonth.m + delta, 1);
      setCalMonth({ y: d.getFullYear(), m: d.getMonth() });
    };
    return (
      <Screen title="Which day?" onBack={backFrom("day")} layout="top">
        <div className="mx-auto w-full max-w-[340px]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => moveMonth(-1)}
              className="glass flex h-11 w-11 items-center justify-center text-[var(--text)] disabled:opacity-30"
              style={{ borderRadius: 12 }}
              aria-label="Previous month"
            >
              <span style={{ transform: "scaleX(-1)", display: "inline-flex" }}><ChevronIcon /></span>
            </button>
            <p className="text-xl font-black text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>
              {MONTH_NAMES_FULL[calMonth.m]} {calMonth.y}
            </p>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => moveMonth(1)}
              className="glass flex h-11 w-11 items-center justify-center text-[var(--text)] disabled:opacity-30"
              style={{ borderRadius: 12 }}
              aria-label="Next month"
            >
              <ChevronIcon />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1" role="grid" aria-label={`${MONTH_NAMES_FULL[calMonth.m]} ${calMonth.y}`}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
              <span key={w} className="py-1 text-center text-xs font-bold text-[var(--dim)]" aria-hidden="true">{w}</span>
            ))}
            {cells.map((dayNum, i) => {
              if (dayNum == null) return <span key={`blank-${i}`} aria-hidden="true" />;
              const key = toDateKey(new Date(calMonth.y, calMonth.m, dayNum));
              const gone = key < todayKey || key > maxKey;
              const picked = schedDate === key;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={gone}
                  onClick={() => { setSchedDate(key); setSchedHour(null); setSchedMinute(null); setSchedAmpm(null); }}
                  className="flex h-11 items-center justify-center text-lg font-bold disabled:opacity-30"
                  style={{
                    borderRadius: 12,
                    fontFamily: "var(--font-display)",
                    background: picked ? "var(--select)" : "var(--glass)",
                    color: picked ? "var(--select-ink)" : "var(--text)",
                    border: picked ? "1.5px solid var(--select)" : isToday ? "1.5px solid var(--text)" : "1.5px solid var(--glass-border)",
                    ...selectStyle(picked),
                  }}
                  aria-label={`Pick ${dayLabel(key)}`}
                  aria-pressed={picked}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
          {schedDate && (
            <p className="mt-5 text-center text-2xl font-black text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>
              {dayLabelFull(schedDate)}
            </p>
          )}
          <button
            type="button"
            disabled={!schedDate}
            onClick={() => setStage("time")}
            className="mt-5 w-full py-4 text-xl font-black disabled:opacity-40"
            style={primaryBtnStyle}
          >
            Next
          </button>
        </div>
      </Screen>
    );
  }

  /* Pick the exact time on that day in three big taps: the hour
     from 1 to 12, the minutes in quarter steps, then AM or PM.
     The whole picked moment sits big under the taps. If the day
     is today and the picked time has already passed, the screen
     says so plainly and Next stays off — a past moment can never
     be posted. No way past this screen without a full time. */
  if (stage === "time") {
    const pickBtn = (on: boolean): CSSProperties => ({
      borderRadius: 12,
      fontFamily: "var(--font-display)",
      ...selectStyle(on),
    });
    return (
      <Screen title="What time?" onBack={backFrom("time")} layout="top">
        <div className="mx-auto w-full max-w-[340px]">
          {schedDate && (
            <p className="text-center text-xl font-black text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>
              {dayLabelFull(schedDate)}
            </p>
          )}
          <div className="mt-5 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Pick the hour">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={schedHour === h}
                aria-label={`Hour ${h}`}
                onClick={() => setSchedHour(h)}
                className="glass py-3.5 text-center text-2xl font-black text-[var(--text)] active:opacity-80"
                style={pickBtn(schedHour === h)}
              >
                {h}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Pick the minutes">
            {[0, 15, 30, 45].map((min) => (
              <button
                key={min}
                type="button"
                role="radio"
                aria-checked={schedMinute === min}
                aria-label={`Minutes ${min === 0 ? "00" : min}`}
                onClick={() => setSchedMinute(min)}
                className="glass py-3.5 text-center text-xl font-black text-[var(--text)] active:opacity-80"
                style={pickBtn(schedMinute === min)}
              >
                :{String(min).padStart(2, "0")}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pick AM or PM">
            {(["AM", "PM"] as const).map((ap) => (
              <button
                key={ap}
                type="button"
                role="radio"
                aria-checked={schedAmpm === ap}
                aria-label={ap}
                onClick={() => setSchedAmpm(ap)}
                className="glass py-3.5 text-center text-2xl font-black text-[var(--text)] active:opacity-80"
                style={pickBtn(schedAmpm === ap)}
              >
                {ap}
              </button>
            ))}
          </div>
          {schedTime && schedDate && !schedInPast && (
            <p className="mt-5 text-center text-2xl font-black text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>
              {dayLabel(schedDate)} at {schedTime}
            </p>
          )}
          {schedInPast && (
            <p className="mt-5 text-center text-lg font-bold" style={{ color: "var(--danger)" }}>
              That time has already passed today. Pick a later time.
            </p>
          )}
          <button
            type="button"
            disabled={!schedTime || schedInPast}
            onClick={() => setStage("pay")}
            className="mt-5 w-full py-4 text-xl font-black disabled:opacity-40"
            style={primaryBtnStyle}
          >
            Next
          </button>
        </div>
      </Screen>
    );
  }

  if (stage === "pay") {
    const saved = profile.mobileMoneyNumber;
    if (saved && mmNumber === null) {
      return (
        <Screen title="Mobile Money" onBack={backFrom("pay")}>
          <p className="text-center text-lg font-semibold text-[var(--dim)]">You pay the worker from your Mobile Money number</p>
          <p className="mt-3 text-center text-3xl font-black tracking-wide text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>{saved}</p>
          {priceBlock}
          <button type="button" onClick={() => { setMmNumber(saved); setStage("note"); }} className="mt-6 w-full py-4 text-xl font-black" style={primaryBtnStyle} aria-label="Pay from my saved Mobile Money number">
            Pay from this number
          </button>
          <button type="button" onClick={() => setMmNumber("")} className="mt-2 w-full py-3 text-center text-base font-bold text-[var(--dim)]" aria-label="Use another Mobile Money number">
            Use another number
          </button>
        </Screen>
      );
    }
    return (
      <Screen title="Mobile Money" onBack={backFrom("pay")}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const num = (mmNumber ?? "").trim();
            if (digits(num).length < 6) { setError("Enter your Mobile Money number."); return; }
            setError(null);
            setMmBusy(true);
            if (num !== profile.mobileMoneyNumber) {
              await api.updateMobileMoney({ profileId: profile.id, number: num });
              await queryClient.invalidateQueries();
            }
            setMmBusy(false);
            setMmNumber(num);
            setStage("note");
          }}
        >
          <p className="mb-3 text-center text-lg font-semibold text-[var(--dim)]">Your Mobile Money number. You pay the worker from it.</p>
          <label className="sr-only" htmlFor="pw-mm">My Mobile Money number</label>
          <input id="pw-mm" value={mmNumber ?? ""} onChange={(e) => setMmNumber(e.target.value)} inputMode="tel" placeholder="0770 000 000" autoComplete="tel" className={bigInputCls} />
          {error && <p className="mt-3 text-center text-base font-semibold" style={{ color: "var(--danger)" }}>{error}</p>}
          {priceBlock}
          <button type="submit" disabled={mmBusy} className="mt-5 w-full py-4 text-xl font-black disabled:opacity-50" style={primaryBtnStyle}>
            {mmBusy ? "Saving..." : "Save and continue"}
          </button>
        </form>
      </Screen>
    );
  }

  if (stage === "note") {
    return (
      <Screen title="Anything else?" onBack={backFrom("note")}>
        <label className="sr-only" htmlFor="pw-note">Note for the worker</label>
        <input id="pw-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Say it in your own words" className={`${bigInputCls} mx-auto w-full max-w-[300px]`} />
        <button type="button" onClick={() => setStage("check")} className="mx-auto mt-6 w-full max-w-[300px] py-4 text-xl font-black" style={primaryBtnStyle}>
          Next
        </button>
        <button type="button" onClick={() => { setNote(""); setStage("check"); }} className="mt-2 w-full py-3 text-center text-base font-bold text-[var(--dim)]" aria-label="Skip the note">
          Skip
        </button>
      </Screen>
    );
  }

  /* Check this one job, then post it. */
  return (
    <Screen title="Check it" onBack={backFrom("check")}>
      {activeService && (
        <div className="glass p-5" style={{ borderRadius: 12 }}>
          <div className="flex flex-col items-center text-center">
            <span className="flex items-center justify-center" style={{ width: 76, height: 76, borderRadius: 12, background: "var(--text)", color: "var(--bg)" }} aria-hidden="true">
              <ServiceIcon icon={activeService.icon} size={42} color="var(--bg)" />
            </span>
            <p className="mt-3 text-2xl font-black text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>{task ?? `${activeService.name} needed`}</p>
            <p className="mt-1 text-base font-semibold text-[var(--dim)]">{activeService.name} · {profile.fullName}</p>
          </div>
          <div className="mt-4 grid gap-1.5 border-t border-[var(--border)] pt-4 text-base font-semibold text-[var(--text)]">
            <span className="inline-flex items-center gap-2"><PinIcon />{jobLocation}</span>
            {jobLandmark && <span>{jobLandmark}</span>}
            <span className="inline-flex items-center gap-2"><PhoneIcon /> Call: {finalCallPhone}</span>
            {profile.houseDirections && <span>House: {profile.houseDirections}</span>}
            {detailText && <span>Details: {detailText}</span>}
            <span>When: {isEmergency ? "Right now" : (schedLabel ?? "")}</span>
            <span>Pay by Mobile Money · {mmNumber ?? profile.mobileMoneyNumber ?? ""}</span>
            {note.trim() && <span>Note: {note.trim()}</span>}
            {amount && <span>Price offered: {currency === "LRD" ? "LD " : "$"}{amount}</span>}
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-center text-base font-semibold" style={{ color: "var(--danger)" }}>{error}</p>}
      <button type="button" disabled={busy} onClick={submit} className="mx-auto mt-5 w-full max-w-[300px] py-4 text-2xl font-black disabled:opacity-50" style={primaryBtnStyle} aria-label="Post this job now">
        {busy ? "Posting..." : "POST JOB"}
      </button>
    </Screen>
  );
}

/* ---------- how near is a job, by the FIXED picked places ----------
   Poster and worker both carry the same fixed county / district /
   town / community entries, so nearness is exact: same community
   is nearest, then same town, then same district, then same
   county. This is the main distance signal; GPS, when both sides
   have it, only breaks ties inside the same level. */
type PlaceFields = { county: string | null; district: string | null; city: string | null; community: string | null };
function placeOf(p: { county?: string | null; district?: string | null; city?: string | null; community?: string | null; address?: string }): PlaceFields {
  return {
    county: p.county ?? null,
    district: p.district ?? null,
    city: p.city ?? null,
    community: p.community ?? (p.address ? p.address : null),
  };
}
function samePlaceWord(a: string | null, b: string | null): boolean {
  return !!a && !!b && norm(a) !== "" && norm(a) === norm(b);
}
function areaScore(poster: PlaceFields | null, me: PlaceFields): number {
  if (!poster) return 400;
  if (samePlaceWord(poster.community, me.community)) return 0;
  if (samePlaceWord(poster.city, me.city)) return 100;
  if (samePlaceWord(poster.district, me.district)) return 200;
  if (samePlaceWord(poster.county, me.county)) return 300;
  return 400;
}
function areaLabel(poster: PlaceFields | null, me: PlaceFields): string | null {
  if (!poster) return null;
  if (samePlaceWord(poster.community, me.community)) return "In your community";
  if (samePlaceWord(poster.city, me.city)) return "In your town";
  if (samePlaceWord(poster.district, me.district)) return "In your district";
  if (samePlaceWord(poster.county, me.county)) return "In your county";
  return null;
}

/* ================================================================
   FIND WORK — one big board. Every open job is here right away.
   The Categories button on the board opens the kinds of work the
   person wants; that work shows first, then jobs in their area,
   then the newest. Nothing is hidden. Category picking lives
   here in Find work, not in the profile.
   ================================================================ */
function BoardFlow({
  profile,
  openJobs,
  loading,
  photoByProfileId,
  placeByProfileId,
  onExit,
  onOpenJob,
}: {
  profile: MyProfile;
  openJobs: Job[];
  loading: boolean;
  photoByProfileId: Map<number, string | null>;
  placeByProfileId: Map<number, PlaceFields>;
  onExit: () => void;
  onOpenJob: (job: Job) => void;
}) {
  const queryClient = useQueryClient();
  const [jobQuery, setJobQuery] = useState("");
  const [showCats, setShowCats] = useState(false);
  const [prefsSel, setPrefsSel] = useState<string[] | null>(null);
  const prefs = profile.workPreferences;

  const list = useMemo(() => {
    let l = openJobs;
    if (jobQuery.trim().length >= 2) {
      const qWords = norm(jobQuery).split(" ").filter(Boolean);
      l = l.filter((j) => {
        const words = norm(`${j.title} ${j.category} ${j.task ?? ""} ${j.location} ${j.customerName}`).split(" ");
        return qWords.every((w) => wordMatches(w, words));
      });
    }
    const myPlace = placeOf(profile);
    const score = (j: Job) => {
      let s = 0;
      if (prefs.length > 0 && !prefs.includes(j.category)) s += 100000;
      // Nearest first by the real distance between the two picked
      // places' coordinates. A job whose place has no coordinates
      // (saved before the real data, or a community town with no
      // surveyed point) sorts after the measured ones, ordered by
      // the fixed-place levels: community, town, district, county.
      const d = placeDistanceKm(j, profile);
      if (d != null) s += d;
      else {
        const poster = j.customerProfileId != null ? (placeByProfileId.get(j.customerProfileId) ?? null) : null;
        s += 1000 + areaScore(poster, myPlace);
      }
      return s;
    };
    return [...l].sort((a, b) => score(a) - score(b) || b.id - a.id);
  }, [openJobs, profile, jobQuery, prefs, placeByProfileId]);

  if (showCats) {
    const sel = prefsSel ?? prefs;
    const toggle = (name: string) =>
      setPrefsSel(sel.includes(name) ? sel.filter((x) => x !== name) : [...sel, name]);
    return (
      <Screen title="Categories" onBack={() => setShowCats(false)} layout="top">
        <p className="mb-4 text-center text-base font-semibold text-[var(--dim)]">Tap the work you want. It shows first on the board. All jobs still show.</p>
        <div className="flex flex-col gap-4">
          {SERVICE_GROUPS.map((g) => (
            <div key={g.name}>
              <p className="mb-2 text-center text-base font-black text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>{g.name}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {g.services.map((sv) => {
                  const on = sel.includes(sv.name);
                  return (
                    <button
                      key={sv.name}
                      type="button"
                      onClick={() => toggle(sv.name)}
                      aria-pressed={on}
                      aria-label={`${on ? "Remove" : "Add"} ${sv.name} to the work I want`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-base font-bold"
                      style={{
                        borderRadius: 12,
                        background: on ? "var(--select)" : "var(--glass)",
                        color: on ? "var(--select-ink)" : "var(--text)",
                        border: "1.5px solid var(--glass-border)",
                        ...selectStyle(on),
                      }}
                    >
                      <ServiceIcon icon={sv.icon} size={18} color={on ? "var(--select-ink)" : "var(--text)"} />
                      {sv.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {/* Normal flow at the end of the list — NOT pinned to the
            bottom of the screen. A pinned solid band here was the
            stray bar/field sitting at the bottom of the app. */}
        <div className="mt-6 pb-2 pt-3">
          <button
            type="button"
            onClick={async () => {
              await api.updateWorkPreferences({ profileId: profile.id, preferences: sel });
              await queryClient.invalidateQueries();
              setShowCats(false);
            }}
            className="mx-auto w-full max-w-[300px] py-4 text-xl font-black"
            style={primaryBtnStyle}
            aria-label="Save the work I want"
          >
            Save
          </button>
          {sel.length > 0 && (
            <button type="button" onClick={() => setPrefsSel([])} className="mt-1 w-full py-2 text-center text-base font-bold text-[var(--dim)]" aria-label="Clear all, I want all work">
              Clear all
            </button>
          )}
        </div>
      </Screen>
    );
  }

  return (
    <Screen title="Find work" onBack={onExit} layout="top">
      <label className="sr-only" htmlFor="bf-search">Search jobs</label>
      <input id="bf-search" value={jobQuery} onChange={(e) => setJobQuery(e.target.value)} placeholder="Search jobs" className={`${bigInputCls} mx-auto w-full max-w-[300px]`} autoComplete="off" />
      <button
        type="button"
        onClick={() => { setPrefsSel(null); setShowCats(true); }}
        className="glass mx-auto mt-3 flex w-full max-w-[300px] items-center justify-center gap-2 py-3 text-base font-extrabold text-[var(--text)]"
        style={{ borderRadius: 12, fontFamily: "var(--font-display)" }}
        aria-label={prefs.length > 0 ? `Categories, ${prefs.length} kinds of work picked` : "Categories, pick the work you want"}
      >
        Categories{prefs.length > 0 ? ` · ${prefs.length} picked` : ""}
      </button>
      {loading && list.length === 0 ? (
        <p className="mt-6 text-center text-base font-semibold text-[var(--dim)]">Loading jobs...</p>
      ) : list.length === 0 ? (
        <p className="mt-6 text-center text-base font-semibold text-[var(--dim)]">
          {jobQuery.trim() ? "No jobs match that search." : "No open jobs right now. New jobs appear here as people post them."}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5 lg:grid lg:grid-cols-2">
          {list.map((j) => {
            const price = money(j);
            const dist = distanceLabel(j, profile);
            const near = areaLabel(j.customerProfileId != null ? (placeByProfileId.get(j.customerProfileId) ?? null) : null, placeOf(profile));
            const wanted = prefs.includes(j.category);
            return (
              <button
                key={j.id}
                type="button"
                onClick={() => onOpenJob(j)}
                className="glass flex w-full items-center gap-3 p-4 text-left active:opacity-80"
                style={{ borderRadius: 12, minHeight: 76 }}
                aria-label={`Open job: ${j.title}, ${j.category}, in ${j.location}, on ${scheduleLabel(j)}`}
              >
                <span className="flex shrink-0 items-center justify-center" style={{ width: 50, height: 50, borderRadius: 12, background: "var(--text)", color: "var(--bg)" }} aria-hidden="true">
                  <ServiceIcon icon={serviceOf(j.category)?.icon ?? "toolbox"} size={27} color="var(--bg)" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-extrabold leading-tight text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>{j.title}</span>
                  <span className="block truncate text-sm font-semibold text-[var(--dim)]">
                    {j.category} · {j.location} · {timeAgo(j.createdAt)}
                  </span>
                  <span className="block truncate text-sm font-extrabold text-[var(--text)]">{scheduleLabel(j)}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-extrabold text-[var(--text)]">{price ?? "Price by phone"}</span>
                    {dist && <span className="px-2 py-0.5 text-xs font-black" style={{ background: "var(--text)", color: "var(--bg)", borderRadius: 12 }}>{dist}</span>}
                    {near && <span className="px-2 py-0.5 text-xs font-black" style={{ background: "var(--text)", color: "var(--bg)", borderRadius: 12 }}>{near}</span>}
                    {wanted && <span className="px-2 py-0.5 text-xs font-black" style={{ background: "var(--yellow)", color: "var(--yellow-ink)", borderRadius: 12 }}>Work you want</span>}
                  </span>
                </span>
                <Avatar name={j.customerName} photoUrl={j.customerProfileId != null ? photoByProfileId.get(j.customerProfileId) : null} size={40} />
              </button>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

/* ================================================================
   MY JOBS — posted or accepted, then a plain list of job names.
   ================================================================ */
function MyJobsFlow({
  myPosted,
  myAccepted,
  onExit,
  onOpenJob,
  onGoPost,
  onGoBoard,
}: {
  myPosted: Job[];
  myAccepted: Job[];
  onExit: () => void;
  onOpenJob: (job: Job) => void;
  onGoPost: () => void;
  onGoBoard: () => void;
}) {
  const [side, setSide] = useState<"posted" | "accepted" | null>(null);

  if (side === null) {
    return (
      <Screen title="My jobs" onBack={onExit}>
        <div className="flex flex-col gap-3">
          <BigChoice
            title="Jobs I posted"
            sub={myPosted.length === 0 ? "Nothing posted yet" : `${myPosted.length} job${myPosted.length === 1 ? "" : "s"}`}
            onClick={() => setSide("posted")}
            ariaLabel="See jobs I posted"
          />
          <BigChoice
            title="Jobs I accepted"
            sub={myAccepted.length === 0 ? "No jobs taken yet" : `${myAccepted.length} job${myAccepted.length === 1 ? "" : "s"}`}
            onClick={() => setSide("accepted")}
            ariaLabel="See jobs I accepted"
          />
        </div>
      </Screen>
    );
  }

  const list = side === "posted" ? myPosted : myAccepted;
  return (
    <Screen title={side === "posted" ? "Jobs I posted" : "Jobs I accepted"} onBack={() => setSide(null)} layout="top">
      {list.length === 0 ? (
        <div className="text-center">
          <p className="text-base font-semibold text-[var(--dim)]">
            {side === "posted" ? "Nothing posted yet." : "No jobs taken yet."}
          </p>
          <button
            type="button"
            onClick={side === "posted" ? onGoPost : onGoBoard}
            className="mt-5 w-full py-4 text-xl font-black"
            style={primaryBtnStyle}
            aria-label={side === "posted" ? "Post a job" : "Find work"}
          >
            {side === "posted" ? "Post a job" : "Find work"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => onOpenJob(j)}
              className="glass flex w-full items-center gap-3 p-4 text-left active:opacity-80"
              style={{ borderRadius: 12, minHeight: 72 }}
              aria-label={`Open job: ${j.title}, ${statusLabel(j.status)}, on ${scheduleLabel(j)}`}
            >
              <span className="flex shrink-0 items-center justify-center" style={{ width: 48, height: 48, borderRadius: 12, background: "var(--text)", color: "var(--bg)" }} aria-hidden="true">
                <ServiceIcon icon={serviceOf(j.category)?.icon ?? "toolbox"} size={26} color="var(--bg)" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>{j.title}</span>
                <span className="block text-sm font-semibold text-[var(--dim)]">{j.location} · {timeAgo(j.createdAt)}</span>
                <span className="block truncate text-sm font-extrabold text-[var(--text)]">{scheduleLabel(j)}</span>
              </span>
              <StatusPill status={j.status} />
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}

/* ================================================================
   ONE JOB — a single job on its own screen.
   ================================================================ */
function JobScreen({
  job,
  profile,
  photoByProfileId,
  onBack,
  onStatus,
  onDelete,
  onRate,
  onAccept,
}: {
  job: Job;
  profile: MyProfile;
  photoByProfileId: Map<number, string | null>;
  onBack: () => void;
  onStatus: (job: Job, status: "open" | "in_progress" | "completed" | "cancelled") => void;
  onDelete: (job: Job) => void;
  onRate: (job: Job, side: "worker" | "customer") => void;
  onAccept: (job: Job) => Promise<{ ok: boolean; error: string | null }>;
}) {
  const [aBusy, setABusy] = useState(false);
  const [aError, setAError] = useState<string | null>(null);
  const isCustomer = job.customerProfileId === profile.id || samePhone(job.customerPhone, profile.phone);
  const isWorker = job.providerId === profile.id || (job.providerPhone != null && samePhone(job.providerPhone, profile.phone));
  const callNumber = job.contactPhone ?? job.customerPhone;

  return (
    <Screen title={job.title} onBack={onBack} layout="top">
      <JobFacts
        job={job}
        profile={profile}
        customerPhotoUrl={job.customerProfileId != null ? photoByProfileId.get(job.customerProfileId) : null}
        workerPhotoUrl={job.providerId != null ? photoByProfileId.get(job.providerId) : null}
        showHouse={isCustomer || isWorker}
      />

      {isCustomer && (
        <div className="mt-4 flex flex-col gap-2.5">
          {job.providerPhone && job.status !== "completed" && job.status !== "cancelled" && (
            <a href={`tel:${digits(job.providerPhone)}`} className="inline-flex w-full items-center justify-center gap-2 py-4 text-lg font-extrabold" style={darkBtnStyle} aria-label={`Call worker ${job.providerName ?? ""}`}>
              <PhoneIcon /> Call worker
            </a>
          )}
          {(job.status === "accepted" || job.status === "in_progress") && (
            <button type="button" onClick={() => onStatus(job, "completed")} className="w-full py-4 text-xl font-black" style={primaryBtnStyle} aria-label="Confirm the job is done">
              Confirm job done
            </button>
          )}
          {(job.status === "open" || job.status === "accepted" || job.status === "in_progress") && (
            <button type="button" onClick={() => onStatus(job, "cancelled")} className="w-full py-3 text-base font-bold" style={{ color: "var(--danger)" }} aria-label={job.status === "open" ? "Cancel this posting" : "Cancel this job"}>
              {job.status === "open" ? "Cancel posting" : "Cancel job"}
            </button>
          )}
          {job.status === "cancelled" && (
            <button type="button" onClick={() => { onDelete(job); onBack(); }} className="w-full py-3 text-base font-bold text-[var(--dim)]" aria-label="Remove this job">
              Remove
            </button>
          )}
          {job.status === "completed" && job.rating == null && (
            <button type="button" onClick={() => onRate(job, "worker")} className="w-full py-4 text-xl font-black" style={primaryBtnStyle} aria-label="Rate the worker">
              Rate the worker
            </button>
          )}
          {job.status === "completed" && job.rating != null && (
            <p className="text-center text-base font-bold text-[var(--text)]">You rated the worker {job.rating} of 5. Thank you.</p>
          )}
          {job.status === "completed" && job.ratingByProvider != null && (
            <p className="text-center text-sm text-[var(--dim)]">The worker rated you {job.ratingByProvider} of 5.{job.reviewByProvider ? ` “${job.reviewByProvider}”` : ""}</p>
          )}
        </div>
      )}

      {isWorker && !isCustomer && (
        <div className="mt-4 flex flex-col gap-2.5">
          {job.status !== "completed" && job.status !== "cancelled" && (
            <a href={`tel:${digits(callNumber)}`} className="inline-flex w-full items-center justify-center gap-2 py-4 text-lg font-extrabold" style={darkBtnStyle} aria-label={`Call customer ${job.customerName}`}>
              <PhoneIcon /> Call {job.customerName.split(" ")[0]}
            </a>
          )}
          {job.status === "accepted" && (
            <button type="button" onClick={() => onStatus(job, "in_progress")} className="w-full py-4 text-xl font-black" style={primaryBtnStyle} aria-label="Start work on this job">
              Start work
            </button>
          )}
          {job.status === "in_progress" && (
            <button type="button" onClick={() => onStatus(job, "completed")} className="w-full py-4 text-xl font-black" style={primaryBtnStyle} aria-label="Mark this job done">
              Mark job done
            </button>
          )}
          {(job.status === "accepted" || job.status === "in_progress") && (
            <button type="button" onClick={() => { onStatus(job, "open"); onBack(); }} className="w-full py-3 text-base font-bold text-[var(--dim)]" aria-label="Release this job back to the board">
              Release job
            </button>
          )}
          {job.status === "completed" && job.rating != null && (
            <p className="text-center text-base font-semibold text-[var(--dim)]">The customer rated you {job.rating} of 5.{job.review ? ` “${job.review}”` : ""}</p>
          )}
          {job.status === "completed" && job.ratingByProvider == null && (
            <button type="button" onClick={() => onRate(job, "customer")} className="w-full py-4 text-xl font-black" style={primaryBtnStyle} aria-label="Rate the customer">
              Rate the customer
            </button>
          )}
          {job.status === "completed" && job.ratingByProvider != null && (
            <p className="text-center text-base font-bold text-[var(--text)]">You rated the customer {job.ratingByProvider} of 5. Thank you.</p>
          )}
        </div>
      )}

      {!isCustomer && !isWorker && job.status === "open" && (
        <div className="mt-4">
          <button
            type="button"
            disabled={aBusy}
            onClick={async () => {
              setAError(null);
              setABusy(true);
              const res = await onAccept(job);
              setABusy(false);
              if (!res.ok) setAError(res.error ?? "Could not accept this job.");
            }}
            className="w-full py-5 text-2xl font-black disabled:opacity-50"
            style={primaryBtnStyle}
            aria-label={`Accept job: ${job.title}`}
          >
            {aBusy ? "Accepting..." : "ACCEPT"}
          </button>
          {aError && <p className="mt-2 text-center text-base font-semibold" style={{ color: "var(--danger)" }}>{aError}</p>}
        </div>
      )}
      {!isCustomer && !isWorker && job.status !== "open" && (
        <p className="mt-4 text-center text-base font-semibold text-[var(--dim)]">This job is not yours. Your own jobs are under My jobs.</p>
      )}
    </Screen>
  );
}

/* ================================================================
   RATE — one question: how was it?
   ================================================================ */
function RateScreen({
  job,
  side,
  onBack,
  onSubmit,
}: {
  job: Job;
  side: "worker" | "customer";
  onBack: () => void;
  onSubmit: (job: Job, side: "worker" | "customer", rating: number, note: string) => void;
}) {
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  return (
    <Screen title={side === "worker" ? "How was the work?" : "How was the customer?"} onBack={onBack}>
      <div className="py-2">
        <Stars value={rating} onPick={setRating} />
      </div>
      {side === "worker" && (
        <div className="mt-4">
          <label htmlFor="rate-note" className="mb-1.5 block text-center text-base font-bold text-[var(--text)]">A short note, if you want</label>
          <input id="rate-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Good work, came on time" className={`${bigInputCls} mx-auto w-full max-w-[300px]`} />
        </div>
      )}
      <button
        type="button"
        disabled={rating === 0}
        onClick={() => { onSubmit(job, side, rating, note); onBack(); }}
        className="mx-auto mt-6 w-full max-w-[300px] py-4 text-xl font-black disabled:opacity-40"
        style={primaryBtnStyle}
        aria-label="Send my rating"
      >
        Send rating
      </button>
    </Screen>
  );
}

/* ================================================================
   PROFILE — only the person: picture, name, phone (it never
   changes), where I live, Mobile Money, ID. No work categories
   here; those live in Find work.
   ================================================================ */
function ProfileFlow({
  profile,
  sessionToken,
  onExit,
  onSignOut,
}: {
  profile: MyProfile;
  sessionToken: string;
  onExit: () => void;
  onSignOut: () => void;
}) {
  const queryClient = useQueryClient();
  const [part, setPart] = useState<"menu" | "photo" | "place" | "id" | "money">("menu");
  // mobile money
  const [mmInput, setMmInput] = useState<string | null>(null);
  const [mmBusy, setMmBusy] = useState(false);
  const [mmError, setMmError] = useState<string | null>(null);
  // photo
  const photoRef = useRef<HTMLInputElement | null>(null);
  const photoCamRef = useRef<HTMLInputElement | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  // ID
  const [idType, setIdType] = useState(ID_TYPES[0] ?? "National ID");
  const [idNumber, setIdNumber] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [idBusy, setIdBusy] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const camRef = useRef<HTMLInputElement | null>(null);
  const statsQ = useQuery({
    queryKey: ["profile-stats", profile.id],
    queryFn: () => api.getProfileStats({ profileId: profile.id }),
  });
  // My own ID document comes only through the session-checked
  // action; the profile payload itself carries no ID fields.
  const idDocQ = useQuery({
    queryKey: ["my-id-doc", profile.id, sessionToken],
    queryFn: () => api.getMyIdDocument({ profileId: profile.id, sessionToken }),
    enabled: part === "id" && sessionToken.length >= 10,
  });

  const verified = profile.verificationStatus === "verified";
  const pending = profile.verificationStatus === "pending";

  async function uploadPhoto(file: File | null) {
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const { dataBase64, mimeType } = await fileToBase64(file);
      const res = await api.uploadProfilePhoto({ profileId: profile.id, dataBase64, mimeType });
      if (!res.ok) setPhotoError(res.error ?? "That photo did not save.");
      else {
        await queryClient.invalidateQueries();
        setPart("menu");
      }
    } catch {
      setPhotoError("That photo could not be read. Try another one.");
    }
    setPhotoBusy(false);
  }

  async function uploadId() {
    setIdError(null);
    if (idNumber.trim().length < 3) { setIdError("Enter the number on the ID."); return; }
    if (!idFile) { setIdError("Take a photo of your ID first."); return; }
    setIdBusy(true);
    try {
      const { dataBase64, mimeType } = await fileToBase64(idFile);
      const res = await api.uploadIdDocument({ profileId: profile.id, idType: idType as "National ID" | "Voter ID" | "Passport" | "Driver license" | "Work ID" | "School ID" | "Other ID", idNumber: idNumber.trim(), dataBase64, mimeType });
      if (!res.ok) setIdError(res.error ?? "Upload failed.");
      else await queryClient.invalidateQueries();
    } catch {
      setIdError("That file could not be read. Try another photo of the ID.");
    }
    setIdBusy(false);
  }

  async function confirmVerify() {
    setIdError(null);
    setIdBusy(true);
    const res = await api.confirmVerification({ profileId: profile.id });
    setIdBusy(false);
    if (!res.ok) setIdError(res.error ?? "Could not finish.");
    else await queryClient.invalidateQueries();
  }

  if (part === "menu") {
    return (
      <Screen title={profile.fullName} onBack={onExit} layout="top">
        <div className="flex flex-col items-center text-center">
          <Avatar name={profile.fullName} photoUrl={profile.profileImageUrl} size={96} />
          <p className="mt-3 inline-flex items-center gap-2 text-xl font-extrabold text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>
            <PhoneIcon /> {profile.phone}
          </p>
          <div className="mt-1.5"><VerifiedBadge status={profile.verificationStatus} /></div>
          {profile.location.trim() && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-base font-semibold text-[var(--dim)]">
              <PinIcon /> {homeLocationWords(profile)}{(profile.community ?? profile.address) ? ` · ${profile.community ?? profile.address}` : ""}
            </p>
          )}
          {statsQ.data && (statsQ.data.jobsDone > 0 || statsQ.data.jobsPosted > 0) && (
            <p className="mt-2 text-base font-bold text-[var(--text)]">
              {statsQ.data.jobsDone > 0 && (
                <span>{statsQ.data.workerAvg != null ? `Rated ${statsQ.data.workerAvg} of 5 · ` : ""}{statsQ.data.jobsDone} job{statsQ.data.jobsDone === 1 ? "" : "s"} done</span>
              )}
              {statsQ.data.jobsDone > 0 && statsQ.data.jobsPosted > 0 && <span className="text-[var(--dim)]"> · </span>}
              {statsQ.data.jobsPosted > 0 && (
                <span>{statsQ.data.jobsPosted} job{statsQ.data.jobsPosted === 1 ? "" : "s"} posted</span>
              )}
            </p>
          )}
        </div>
        <div className="mt-7 flex flex-col gap-3 lg:grid lg:grid-cols-2">
          <BigChoice
            title="My photo"
            sub={profile.profileImageUrl ? "Change my picture" : "Add my picture"}
            icon={<ServiceIcon icon="camera" size={26} />}
            onClick={() => setPart("photo")}
            ariaLabel="My profile photo"
          />
          <BigChoice
            title="Where I live"
            sub={profile.location.trim() ? homeLocationWords(profile) : "Not set yet"}
            icon={<PinIcon />}
            onClick={() => setPart("place")}
            ariaLabel="Change where I live"
          />
          <BigChoice
            title="Mobile Money"
            sub={profile.mobileMoneyNumber ?? "Add your number"}
            icon={<PhoneIcon />}
            onClick={() => setPart("money")}
            ariaLabel="My Mobile Money number"
          />
          <BigChoice
            title="My ID"
            sub={verified ? "Verified" : pending ? "Uploaded, one step left" : "Add any ID you have"}
            icon={<ShieldIcon />}
            onClick={() => setPart("id")}
            ariaLabel="My ID and verification"
          />
        </div>
        <button type="button" onClick={onSignOut} className="mt-6 w-full py-3 text-center text-base font-bold text-[var(--dim)]" aria-label="Sign out on this device">
          Sign out
        </button>
      </Screen>
    );
  }

  if (part === "photo") {
    return (
      <Screen title="My photo" onBack={() => setPart("menu")}>
        <div className="flex flex-col items-center">
          <Avatar name={profile.fullName} photoUrl={profile.profileImageUrl} size={120} />
        </div>
        <div className="mx-auto mt-6 flex w-full max-w-[300px] flex-col gap-3">
          <button type="button" disabled={photoBusy} onClick={() => photoCamRef.current?.click()} className="inline-flex w-full items-center justify-center gap-2 py-4 text-xl font-black disabled:opacity-50" style={primaryBtnStyle} aria-label="Take a photo with the camera">
            <ServiceIcon icon="camera" size={24} /> Take a photo
          </button>
          <button type="button" disabled={photoBusy} onClick={() => photoRef.current?.click()} className="glass w-full py-4 text-lg font-extrabold text-[var(--text)] disabled:opacity-50" style={glassBtnStyle} aria-label="Pick a photo from my phone">
            Pick a photo
          </button>
        </div>
        <input ref={photoCamRef} type="file" accept="image/*" capture="user" className="hidden" aria-label="Take a profile photo" onChange={(e) => { void uploadPhoto(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <input ref={photoRef} type="file" accept="image/*" className="hidden" aria-label="Profile photo file" onChange={(e) => { void uploadPhoto(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        {photoBusy && <p className="mt-3 text-center text-base font-semibold text-[var(--dim)]" role="status">Saving...</p>}
        {photoError && <p className="mt-3 text-center text-base font-semibold" style={{ color: "var(--danger)" }}>{photoError}</p>}
      </Screen>
    );
  }

  if (part === "place") {
    return (
      <PlacePicker
        initial={{ county: profile.county ?? "", district: profile.district ?? "", city: profile.city ?? "", community: profile.community ?? profile.address, house: profile.houseDirections ?? "" }}
        onBack={() => setPart("menu")}
        onDone={async (p) => {
          await api.updateHomeLocation({ profileId: profile.id, county: p.county, district: p.district, city: p.city, community: p.community ?? undefined, houseDirections: p.house, placeLat: p.lat ?? undefined, placeLng: p.lng ?? undefined });
          await queryClient.invalidateQueries();
          setPart("menu");
        }}
      />
    );
  }

  if (part === "money") {
    return (
      <Screen title="Mobile Money" onBack={() => setPart("menu")}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const num = (mmInput ?? profile.mobileMoneyNumber ?? "").trim();
            if (digits(num).length < 6) { setMmError("Enter your Mobile Money number."); return; }
            setMmError(null);
            setMmBusy(true);
            await api.updateMobileMoney({ profileId: profile.id, number: num });
            await queryClient.invalidateQueries();
            setMmBusy(false);
            setPart("menu");
          }}
        >
          <p className="mb-3 text-center text-base font-semibold text-[var(--dim)]">This is the number you pay from and get paid on.</p>
          <label className="sr-only" htmlFor="pf-mm">My Mobile Money number</label>
          <input id="pf-mm" value={mmInput ?? profile.mobileMoneyNumber ?? ""} onChange={(e) => setMmInput(e.target.value)} inputMode="tel" placeholder="0770 000 000" autoComplete="tel" className={bigInputCls} />
          {mmError && <p className="mt-3 text-center text-base font-semibold" style={{ color: "var(--danger)" }}>{mmError}</p>}
          <button type="submit" disabled={mmBusy} className="mt-5 w-full py-4 text-xl font-black disabled:opacity-50" style={primaryBtnStyle} aria-label="Save my Mobile Money number">
            {mmBusy ? "Saving..." : "Save"}
          </button>
        </form>
      </Screen>
    );
  }

  /* My ID: take the picture with the camera, any ID counts. */
  return (
    <Screen title="My ID" onBack={() => setPart("menu")}>
      {verified ? (
        <div className="text-center">
          <span className="inline-flex items-center justify-center" style={{ width: 84, height: 84, borderRadius: 12, background: "var(--text)", color: "var(--bg)" }} aria-hidden="true">
            <ShieldIcon />
          </span>
          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-[var(--dim)]">
            Done. Your {profile.idType ?? "ID"}{idDocQ.data?.idNumberTail ? ` ending in ${idDocQ.data.idNumberTail}` : ""} is on file.
          </p>
        </div>
      ) : pending ? (
        <div>
          <p className="text-center text-base leading-relaxed text-[var(--dim)]">
            Your {profile.idType ?? "ID"} is uploaded. Check the name on it matches <strong className="text-[var(--text)]">{profile.fullName}</strong>, then finish.
          </p>
          {idDocQ.data?.idImageUrl && (
            <img src={idDocQ.data.idImageUrl} alt={`Your uploaded ${profile.idType ?? "ID"} document`} className="mx-auto mt-4 max-h-56 w-auto border border-[var(--border)] object-contain" style={{ borderRadius: 12 }} />
          )}
          <label className="glass mx-auto mt-4 flex w-full max-w-[300px] items-start gap-3 p-4" style={{ borderRadius: 12 }}>
            <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} className="mt-0.5 h-7 w-7 shrink-0" aria-label="Confirm this ID is mine and matches my profile" />
            <span className="text-base text-[var(--text)]">This is my own ID, and the name on it matches my name here.</span>
          </label>
          {idError && <p className="mt-3 text-center text-base font-semibold" style={{ color: "var(--danger)" }}>{idError}</p>}
          <button type="button" disabled={!confirmChecked || idBusy} onClick={confirmVerify} className="mt-4 w-full py-4 text-xl font-black disabled:opacity-40" style={primaryBtnStyle} aria-label="Finish ID verification">
            {idBusy ? "Checking..." : "Finish"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="mx-auto w-full max-w-[300px]">
            <label htmlFor="pf-idtype" className="mb-1.5 block text-base font-bold text-[var(--text)]">What ID do you have?</label>
            <select id="pf-idtype" value={idType} onChange={(e) => setIdType(e.target.value)} className={bigInputCls}>
              {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="mx-auto w-full max-w-[300px]">
            <label htmlFor="pf-idnum" className="mb-1.5 block text-base font-bold text-[var(--text)]">ID number</label>
            <input id="pf-idnum" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="Number on the ID" className={bigInputCls} />
          </div>
          <div className="mx-auto flex w-full max-w-[300px] flex-col gap-2.5">
            <button type="button" onClick={() => camRef.current?.click()} className="inline-flex w-full items-center justify-center gap-2 py-4 text-lg font-black" style={darkBtnStyle} aria-label="Take a photo of my ID with the camera">
              <ServiceIcon icon="camera" size={24} /> Take a photo of my ID
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="glass w-full py-3.5 text-base font-extrabold text-[var(--text)]" style={glassBtnStyle} aria-label="Pick a photo of my ID">
              {idFile ? idFile.name : "Pick a photo instead"}
            </button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="ID photo from camera" onChange={(e) => { setIdFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="ID photo file" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
          {idFile && <p className="text-center text-sm font-semibold text-[var(--dim)]">{idFile.name}</p>}
          {idError && <p className="text-center text-base font-semibold" style={{ color: "var(--danger)" }}>{idError}</p>}
          <button type="button" disabled={idBusy} onClick={uploadId} className="mx-auto w-full max-w-[300px] py-4 text-xl font-black disabled:opacity-50" style={primaryBtnStyle} aria-label="Send my ID">
            {idBusy ? "Sending..." : "Send my ID"}
          </button>
        </div>
      )}
    </Screen>
  );
}

/* ================================================================
   THE APP — full screen, one screen at a time.
   The start screen only asks "What do you want to do?" with plain
   short labels: Post a job, Find work, My jobs, and the person's
   own profile row with their picture and phone number.
   ================================================================ */
type TopScreen = "start" | "post" | "board" | "myjobs" | "job" | "rate" | "profile" | "callin";

const PHONE_KEY = "jackwork_profile_phone";
const TOKEN_KEY = "jackwork_session_token";

export function App() {
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<TopScreen>("start");
  const [storedPhone, setStoredPhone] = useState<string>(() => {
    try { return localStorage.getItem(PHONE_KEY) ?? ""; } catch { return ""; }
  });
  const [storedToken, setStoredToken] = useState<string>(() => {
    try { return localStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; }
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [openJobId, setOpenJobId] = useState<number | null>(null);
  const [jobReturn, setJobReturn] = useState<"myjobs" | "board">("myjobs");
  const [rateTarget, setRateTarget] = useState<{ job: Job; side: "worker" | "customer" } | null>(null);
  const [callInReturn, setCallInReturn] = useState<"signin" | "start">("signin");

  const profileQ = useQuery({
    queryKey: ["my-profile", storedPhone, storedToken],
    queryFn: () => api.getMyProfile({ phone: storedPhone, sessionToken: storedToken }),
    enabled: digits(storedPhone).length >= 6 && storedToken.length >= 10,
  });

  const profile: MyProfile | null = profileQ.data?.profile ?? null;

  const jobsQ = useQuery({
    queryKey: ["jobs", storedToken],
    queryFn: () => api.listJobs({ limit: 200, viewerSessionToken: storedToken || undefined }),
  });
  const allProfilesQ = useQuery({
    queryKey: ["all-profiles"],
    queryFn: () => api.listAllProfiles({ limit: 200 }),
    enabled: digits(storedPhone).length >= 6,
  });
  const jobs = useMemo(() => jobsQ.data?.jobs ?? [], [jobsQ.data]);
  const openJobs = useMemo(() => jobs.filter((j) => j.status === "open"), [jobs]);
  const allProfiles = useMemo(() => allProfilesQ.data?.profiles ?? [], [allProfilesQ.data]);
  const photoByProfileId = useMemo(() => {
    const m = new Map<number, string | null>();
    for (const p of allProfiles) m.set(p.id, p.profileImageUrl);
    if (profile) m.set(profile.id, profile.profileImageUrl);
    return m;
  }, [allProfiles, profile]);
  const placeByProfileId = useMemo(() => {
    const m = new Map<number, PlaceFields>();
    for (const p of allProfiles) m.set(p.id, placeOf(p));
    if (profile) m.set(profile.id, placeOf(profile));
    return m;
  }, [allProfiles, profile]);
  const myPosted = useMemo(
    () => (profile ? jobs.filter((j) => j.customerProfileId === profile.id || samePhone(j.customerPhone, profile.phone)) : []),
    [jobs, profile],
  );
  const myAccepted = useMemo(
    () => (profile ? jobs.filter((j) => j.providerId === profile.id || (j.providerPhone != null && samePhone(j.providerPhone, profile.phone))) : []),
    [jobs, profile],
  );
  const myActiveCount = useMemo(
    () => [...myPosted, ...myAccepted].filter((j) => j.status === "accepted" || j.status === "in_progress" || j.status === "open").length,
    [myPosted, myAccepted],
  );
  const openJob = useMemo(() => jobs.find((j) => j.id === openJobId) ?? null, [jobs, openJobId]);
  const needsSetup = !!profile && !profile.county && profile.location.trim().length < 2;

  function rememberPhone(phone: string, sessionToken: string) {
    setStoredPhone(phone);
    setStoredToken(sessionToken);
    try {
      localStorage.setItem(PHONE_KEY, phone);
      localStorage.setItem(TOKEN_KEY, sessionToken);
    } catch { /* private mode */ }
  }
  function forgetPhone() {
    setStoredPhone("");
    setStoredToken("");
    try {
      localStorage.removeItem(PHONE_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch { /* private mode */ }
    queryClient.invalidateQueries();
    setScreen("start");
  }
  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 4500);
  }
  function goToJob(job: Job, from: "myjobs" | "board") {
    setOpenJobId(job.id);
    setJobReturn(from);
    setScreen("job");
  }

  const statusMut = useMutation({
    mutationFn: async (args: { job: Job; status: "open" | "in_progress" | "completed" | "cancelled" }) =>
      api.updateJobStatus({ jobId: args.job.id, status: args.status }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const rateMut = useMutation({
    mutationFn: async (args: { job: Job; rating: number; review: string }) =>
      api.rateJob({ jobId: args.job.id, rating: args.rating, review: args.review || undefined }),
    onSuccess: () => { queryClient.invalidateQueries(); flash("Rating sent. Thank you."); },
  });
  const rateCustomerMut = useMutation({
    mutationFn: async (args: { job: Job; rating: number }) =>
      api.rateCustomer({ jobId: args.job.id, rating: args.rating }),
    onSuccess: () => { queryClient.invalidateQueries(); flash("Rating sent. Thank you."); },
  });
  const deleteMut = useMutation({
    mutationFn: async (job: Job) => api.deleteJob({ jobId: job.id }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  async function handleAccept(job: Job): Promise<{ ok: boolean; error: string | null }> {
    if (!profile) return { ok: false, error: "Sign in first." };
    const res = await api.acceptJob({ jobId: job.id, providerProfileId: profile.id });
    if (res.ok) {
      await queryClient.invalidateQueries();
      flash(`You accepted “${job.title}”.`);
    }
    return res;
  }

  const signedIn = !!profile;
  const loadingProfile = digits(storedPhone).length >= 6 && storedToken.length >= 10 && profileQ.isPending;

  return (
    <div
      className="flex min-h-dvh w-full flex-col text-[var(--text)]"
      style={{
        backgroundColor: "var(--bg)",
        backgroundImage:
          "radial-gradient(65% 42% at 12% 6%, var(--glow-1), transparent 70%)," +
          "radial-gradient(55% 38% at 88% 88%, var(--glow-2), transparent 70%)," +
          "radial-gradient(75% 48% at 50% 44%, var(--glow-3), transparent 72%)," +
          "radial-gradient(45% 32% at 22% 82%, var(--glow-4), transparent 70%)",
      }}
    >
      <main className="flex w-full flex-1 flex-col px-4 pb-5 pt-4 sm:px-6 lg:px-10">
        {notice && screen !== "board" && (
          <div className="mb-3 w-full" role="status">
            <p className="glass px-4 py-3 text-center text-base font-bold text-[var(--text)]" style={{ borderRadius: 12 }}>{notice}</p>
          </div>
        )}

        {loadingProfile && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-lg font-bold text-[var(--dim)]">Loading...</p>
          </div>
        )}

        {/* Signed out: sign-in screens, or the call-in screen. */}
        {!signedIn && !loadingProfile && screen !== "callin" && (
          <SignInFlow
            onDone={(phone, token) => { rememberPhone(phone, token); setScreen("start"); flash("You are signed in."); }}
            onCallIn={() => { setCallInReturn("signin"); setScreen("callin"); }}
          />
        )}
        {!signedIn && !loadingProfile && screen === "callin" && (
          <CallInScreen onBack={() => setScreen("start")} />
        )}

        {/* Signed in but no home place yet: pick it once. */}
        {profile && needsSetup && screen === "start" && (
          <PlacePicker
            onBack={forgetPhone}
            onDone={async (place) => {
              await api.updateHomeLocation({
                profileId: profile.id,
                county: place.county,
                district: place.district,
                city: place.city,
                community: place.community ?? undefined,
                houseDirections: place.house,
                placeLat: place.lat ?? undefined,
                placeLng: place.lng ?? undefined,
              });
              await queryClient.invalidateQueries();
            }}
          />
        )}

        {/* Start: one question, THREE equal choices in one compact
            group in the middle. Nothing is highlighted. The profile
            is NOT one of the choices: it sits small in the bottom
            corner, just the person's picture and name. */}
        {profile && !needsSetup && screen === "start" && (
          <div className="relative flex w-full flex-1 flex-col">
            <BrandMark />
            <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center justify-center pb-16">
              <h1 className="w-full text-center text-[30px] font-black leading-tight text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>
                What do you want to do?
              </h1>
              <div className="mt-5 flex w-full flex-col gap-3">
                <BigChoice
                  title="Post a job"
                  onClick={() => setScreen("post")}
                  ariaLabel="Post a job"
                />
                <BigChoice
                  title="Find work"
                  badge={openJobs.length > 0 ? String(openJobs.length) : undefined}
                  onClick={() => setScreen("board")}
                  ariaLabel="Find work"
                />
                <BigChoice
                  title="My jobs"
                  badge={myActiveCount > 0 ? String(myActiveCount) : undefined}
                  onClick={() => setScreen("myjobs")}
                  ariaLabel="My jobs"
                />
              </div>
              <div className="mt-6 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => { setCallInReturn("start"); setScreen("callin"); }}
                  className="inline-flex items-center gap-2 py-2 text-base font-bold text-[var(--dim)]"
                  aria-label="Call in"
                >
                  <PhoneIcon /> Call in
                </button>
              </div>
            </div>
            {/* Small profile corner: just a small picture and the
                first name, NO glass box, border, or shadow — a boxed
                chip here looked like a stray field sitting at the
                bottom of the app. */}
            <button
              type="button"
              onClick={() => setScreen("profile")}
              aria-label={`My profile, ${profile.fullName}, ${profile.phone}`}
              className="absolute bottom-1 right-0 flex items-center gap-2 py-1.5 pl-1.5 pr-2.5 active:opacity-70"
              style={{ borderRadius: 12, background: "transparent" }}
            >
              <Avatar name={profile.fullName} photoUrl={profile.profileImageUrl} size={32} />
              <span className="max-w-[120px] truncate text-sm font-extrabold leading-tight text-[var(--text)]" style={{ fontFamily: "var(--font-display)" }}>{profile.fullName.split(" ")[0]}</span>
            </button>
          </div>
        )}

        {profile && screen === "callin" && (
          <CallInScreen onBack={() => setScreen(callInReturn === "start" ? "start" : "start")} />
        )}

        {profile && screen === "post" && (
          <PostWizard
            profile={profile}
            onExit={() => setScreen("start")}
            onPosted={() => { flash("Your job is live. It is in My jobs now."); setScreen("myjobs"); }}
          />
        )}

        {profile && screen === "board" && (
          <BoardFlow
            profile={profile}
            openJobs={openJobs}
            loading={jobsQ.isPending}
            photoByProfileId={photoByProfileId}
            placeByProfileId={placeByProfileId}
            onExit={() => setScreen("start")}
            onOpenJob={(job) => goToJob(job, "board")}
          />
        )}

        {profile && screen === "myjobs" && (
          <MyJobsFlow
            myPosted={myPosted}
            myAccepted={myAccepted}
            onExit={() => setScreen("start")}
            onOpenJob={(job) => goToJob(job, "myjobs")}
            onGoPost={() => setScreen("post")}
            onGoBoard={() => setScreen("board")}
          />
        )}

        {profile && screen === "job" && (
          openJob ? (
            <JobScreen
              job={openJob}
              profile={profile}
              photoByProfileId={photoByProfileId}
              onBack={() => setScreen(jobReturn)}
              onStatus={(job, status) => statusMut.mutate({ job, status })}
              onDelete={(job) => deleteMut.mutate(job)}
              onRate={(job, side) => { setRateTarget({ job, side }); setScreen("rate"); }}
              onAccept={handleAccept}
            />
          ) : (
            <Screen title="That job is gone" onBack={() => setScreen(jobReturn)}>
              <button type="button" onClick={() => setScreen(jobReturn)} className="w-full py-4 text-xl font-black" style={primaryBtnStyle} aria-label="Go back">
                Go back
              </button>
            </Screen>
          )
        )}

        {profile && screen === "rate" && rateTarget && (
          <RateScreen
            job={rateTarget.job}
            side={rateTarget.side}
            onBack={() => setScreen("job")}
            onSubmit={(job, side, rating, note) => {
              if (side === "worker") rateMut.mutate({ job, rating, review: note });
              else rateCustomerMut.mutate({ job, rating });
            }}
          />
        )}

        {profile && screen === "profile" && (
          <ProfileFlow profile={profile} sessionToken={storedToken} onExit={() => setScreen("start")} onSignOut={forgetPhone} />
        )}
      </main>
    </div>
  );
}
