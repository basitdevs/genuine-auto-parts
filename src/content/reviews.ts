/**
 * Customer reviews copied from our Google Business Profile (November 2026).
 *
 * - Text is as written, with spacing and obvious typos lightly fixed. Spanish reviews use
 *   Google's English translation.
 * - Names are shown as first name + last initial; handles are kept as written.
 * - `date` is the month the review was posted (YYYY-MM), worked out from Google's
 *   relative dates on 2026-11-20, so it never goes stale like "a month ago".
 * - Star ratings weren't part of the copy, so we don't show per-review stars.
 *   Set `business.rating` in business.ts to show the overall Google rating.
 * - Reviews with no text are left out.
 */
export type Review = {
  author: string;
  text: string;
  date: string;
  localGuide?: boolean;
  translatedFrom?: string;
  ownerReply?: string;
  /** Shown as a large card in the home page section. */
  featured?: boolean;
};

export const reviews: Review[] = [
  {
    author: "Charles F.",
    date: "2026-08",
    featured: true,
    text: "Excellent customer service and a great selection of parts. They answered all my questions, had what I needed in stock, and got me back on the road quickly. It’s hard to find an honest and reliable auto parts store these days, but Genuine Auto & Truck Parts definitely earned my business. Highly recommend!",
    ownerReply:
      "Charles, we’re glad our team could answer your questions and get the part you needed in stock without the wait. Providing honest service and dependable auto parts is exactly what we aim for.",
  },
  {
    author: "A. J.",
    date: "2026-08",
    featured: true,
    text: "Outstanding operations and services speed, I was in and out in less than 15 minutes with new transmission. I work on cars myself and this was the fastest and smoothest transaction I've experienced compared to other yards!",
  },
  {
    author: "Jayden L.",
    date: "2026-11",
    featured: true,
    text: "Great oem parts for my Mercedes with reasonable prices, I called and picked up same day less in than 30 minutes! I will definitely be back.",
  },
  {
    author: "Zuki’s Pita",
    date: "2026-08",
    featured: true,
    text: "Great experience from start to finish. The staff was friendly, knowledgeable, and helped me find the exact part I needed without wasting any time. Prices were fair, and everything fit perfectly. I’ll definitely be coming back for any future auto parts.",
    ownerReply:
      "It’s great to hear everything went smoothly from the moment you arrived. Finding the exact part quickly, offering fair pricing, and making the experience easy is what our team works toward every day.",
  },
  {
    author: "Ravi W.",
    date: "2026-11",
    featured: true,
    text: "Needed parts same day, and they gave me an excellent deal. Definitely recommend for BMW parts. Friendly staff as well",
  },
  {
    author: "Oceandrive12",
    date: "2026-01",
    text: "I went to a few yards and they didn’t have the part I was looking for. I didn’t know this place existed. They had the part that I wanted, ready when I arrived there! Definitely recommend this place.",
  },
  {
    author: "Genesis A.",
    date: "2026-10",
    localGuide: true,
    text: "Best place ever. Come look for Mike he has everything you need. Super friendly and has great prices come check them out.",
  },
  {
    author: "Mustafa T.",
    date: "2026-03",
    localGuide: true,
    text: "Stopped by genuine auto to pick up a part I needed and had a really good experience. They knew exactly what I was talking about, got the part quickly, and the price was great. Everything went smooth and easy. Definitely a solid spot if you need auto parts.",
    ownerReply:
      "Mustafa, glad your visit was smooth from start to finish. Our team takes pride in understanding what customers are looking for, locating the right part quickly, and keeping prices fair.",
  },
  {
    author: "Clancy D.",
    date: "2026-10",
    localGuide: true,
    text: "Mur was a great guy. Communication was excellent. Went out of his way to ensure I had the correct parts.",
  },
  {
    author: "Gustavo N.",
    date: "2026-10",
    text: "Fair Prices, Great service, Tested parts, doesn't get better than that. Will definitely be my to-go spot from now on.",
  },
  {
    author: "Dianah K.",
    date: "2026-10",
    text: "Exceptional. Bought a part which was in great shape. Mike was very helpful and made the process super smooth. I highly recommend this place!",
  },
  {
    author: "Arnold G.",
    date: "2026-08",
    text: "Quick and easy, purchased a transmission ran perfect, great customer service",
    ownerReply:
      "Arnold, it’s great to hear the transmission is running perfectly. Getting customers the right part without making the process complicated is always the goal.",
  },
  {
    author: "Eduardo G.",
    date: "2026-10",
    localGuide: true,
    text: "Great service, quality parts. Fast service. Great place to get used oem parts.",
  },
  {
    author: "Omar M.",
    date: "2026-03",
    localGuide: true,
    text: "These guys are legit and can get you any part for your car. They understand the car world industry.",
    ownerReply:
      "Omar, we appreciate you recognizing the knowledge behind our service. Knowing the automotive industry helps us track down the right parts and make the process easier for our customers.",
  },
  {
    author: "Steve R.",
    date: "2026-09",
    localGuide: true,
    text: "Very helpful with figuring out my exact oem parts for my car.",
  },
  {
    author: "Erick R.",
    date: "2026-08",
    text: "Hidden gem, highly recommend if you need a part to your vehicle! Check these guys out first.",
  },
  {
    author: "Amber G.",
    date: "2026-10",
    text: "Finally Resale parts where you get the right parts you get sound advice and you get great prices!",
  },
  {
    author: "Alfredo Q.",
    date: "2026-02",
    text: "Very helpful, they found the part I need quick and good price and conditions",
  },
  {
    author: "Moe",
    date: "2026-03",
    text: "very nice people had what i needed gave me it same day definitely recommend",
    ownerReply:
      "Great to hear we had exactly what you needed and were able to get it to you the same day. Fast service matters when you’re trying to get a vehicle back on the road.",
  },
  {
    author: "Monique C.",
    date: "2026-10",
    text: "Affordable pricing very simple and fast service. Highly recommended",
  },
  {
    author: "San I.",
    date: "2026-08",
    text: "Great business, ethical owner. Highly recommend!",
    ownerReply:
      "We really appreciate you recognizing the way we do business. Running an honest, dependable auto parts store and treating people fairly matters to our entire team.",
  },
  {
    author: "Killman B.",
    date: "2026-04",
    localGuide: true,
    text: "Genuine place, not fake. Good explanations and service",
  },
  {
    author: "Maria F.",
    date: "2026-10",
    text: "Amazing company and parts are very good. Thank you for helping me ☺️",
  },
  {
    author: "Ammar A.",
    date: "2026-09",
    text: "Great people and good parts customer service are always helpful thanks guys",
  },
  {
    author: "Pakdoojus",
    date: "2026-11",
    localGuide: true,
    text: "Always courteous and knowledgeable",
  },
  {
    author: "Codename1",
    date: "2026-08",
    text: "Good customer service, fast business good parts",
    ownerReply:
      "Glad you had a good experience with our team and found the parts you needed. We work hard to keep service fast and straightforward while offering dependable used auto parts at fair prices.",
  },
  {
    author: "Andrew B.",
    date: "2026-10",
    text: "Best guys out there really nice very helpful",
  },
  {
    author: "Annel W.",
    date: "2026-08",
    localGuide: true,
    text: "Great customer service and awesome to get parts",
  },
  {
    author: "Hermes B.",
    date: "2026-11",
    translatedFrom: "Spanish",
    text: "Excellent service and customer support",
  },
  {
    author: "Omar P.",
    date: "2026-11",
    translatedFrom: "Spanish",
    text: "Good service, recommended for all types of cars",
  },
  {
    author: "Alianet R.",
    date: "2026-11",
    translatedFrom: "Spanish",
    text: "Good service, fast and comfortable",
  },
  {
    author: "Brandon J.",
    date: "2026-10",
    translatedFrom: "Spanish",
    text: "Excellent service 10/10",
  },
  {
    author: "Jose L.",
    date: "2026-10",
    translatedFrom: "Spanish",
    text: "Highly recommended parts",
  },
  {
    author: "Selim H.",
    date: "2026-11",
    localGuide: true,
    text: "Great place Great prices",
  },
  {
    author: "Adrian J.",
    date: "2026-10",
    localGuide: true,
    text: "Great service will return again",
  },
  {
    author: "Olando D.",
    date: "2026-10",
    text: "Great place great business highly recommend",
  },
  {
    author: "Safaa S.",
    date: "2025-11",
    localGuide: true,
    text: "Best prices",
  },
  {
    author: "Raul L.",
    date: "2026-10",
    text: "Very good service",
  },
];

/** "2026-08" -> "Aug 2026" */
export function reviewMonth(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
