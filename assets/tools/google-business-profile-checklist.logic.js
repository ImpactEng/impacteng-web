

(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.IEToolLogic = root.IEToolLogic || {}; root.IEToolLogic.gbpChecklist = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var G = 'https://support.google.com/business/answer/';
  var EDIT = G + '3039617', GUIDE = G + '3038177', USERS = G + '3403100', HOURS = G + '6303076';
  var PHOTOS = G + '6103862', POSTS = G + '7342169', REVIEWS = G + '3474122', SCAMS = G + '6212928';

  var ITEMS = [
    { id: 'verify', text: 'Check that your profile is verified.',
      why: 'Google says you must add or claim your business, then verify your Business Profile, to show it on Search, Maps and other Google services. Some businesses must verify before they can change their details at all. Google says you might need to verify again if you change your business name, and that you must if you move to a new address.',
      source: EDIT, sourceName: 'Google: Edit your Business Profile' },
    { id: 'name', text: 'Use your business name as it is used in the real world.',
      why: 'Google says your name should reflect your business\'s real-world name, and that unnecessary extra information in the name is not permitted. I suggest you match your sign, invoices and website.',
      source: GUIDE, sourceName: 'Google: Guidelines for representing your business' },
    { id: 'category', text: 'Choose a primary category that describes your core business, and keep other categories few.',
      why: 'Google says to use as few categories as possible to describe your overall core business, and to select categories that complete the statement it gives on that page.',
      source: GUIDE, sourceName: 'Google: Guidelines for representing your business' },
    { id: 'location', text: 'Show an accurate address, or an accurate service area if you travel to customers.',
      why: 'Google says to use a precise, accurate address or service area, for your real-world location. Mailboxes at remote locations and P.O. boxes are not acceptable. Service-area businesses should hide their address from customers if they serve customers elsewhere, and the area should not extend farther than about 2 hours of driving from where the business is based.',
      source: GUIDE, sourceName: 'Google: Guidelines for representing your business' },
    { id: 'hours', text: 'Set your regular opening hours.',
      why: 'Google says to provide your regular customer-facing hours. I suggest you re-read them whenever your roster changes, because wrong hours send people to a locked door.',
      source: GUIDE, sourceName: 'Google: Guidelines for representing your business' },
    { id: 'special-hours', text: 'Set special hours for public holidays and short closures.',
      why: 'Google says to use special hours when your hours change for a brief period, such as holidays or special events, and to confirm hours for official holidays even if they are the same as usual. Special hours cover closures of up to 6 days in a row; for longer closures Google points to "Temporarily closed". They show only if your hours are set to "Open with main hours".',
      source: HOURS, sourceName: 'Google: How to set special hours' },
    { id: 'phone', text: 'List a phone number your business controls and answers.',
      why: 'Google says the number should connect to your individual business location, be under the direct control of the business, and be a local number rather than a central call-centre line where possible.',
      source: GUIDE, sourceName: 'Google: Guidelines for representing your business' },
    { id: 'website', text: 'Link to a website that represents your business location.',
      why: 'Google says to provide a website that represents your individual business location, and not to provide phone numbers or web addresses that redirect or "refer" users elsewhere. I suggest you click your own link on a phone to check that it loads.',
      source: GUIDE, sourceName: 'Google: Guidelines for representing your business' },
    { id: 'photos', text: 'Add photos of your shopfront, your work and your team.',
      why: 'Google suggests adding photos and videos of your storefront, products and services. They show only after you verify, and can take 24 to 48 hours to appear. Photos should be JPG or PNG, between 10 KB and 5 MB, in focus and well lit.',
      source: PHOTOS, sourceName: 'Google: Manage your Business Profile photos and videos' },
    { id: 'description', text: 'Write a short business description about what you do.',
      why: 'Google says to use the description to give useful information on the services and products you offer, not to focus on special offers, prices or sales, and that links of any type are not allowed.',
      source: GUIDE, sourceName: 'Google: Guidelines for representing your business' },
    { id: 'posts', text: 'Post an update when something changes, and check old posts.',
      why: 'Google says posts can share announcements, offers, updates and event details on Search and Maps, and that posts older than 6 months are archived unless a date range is set. Posts must be respectful and link only to websites you trust. I suggest a post only when you have something real to say.',
      source: POSTS, sourceName: 'Google: Create and manage posts' },
    { id: 'ask-reviews', text: 'Ask happy customers for a review, and never pay for one.',
      why: 'Google says you can ask customers to visit a Google link or scan a QR code to leave a review. Offering free or discounted goods or services in exchange for reviews, for changing reviews, or for removing negative reviews is strictly prohibited.',
      source: REVIEWS, sourceName: 'Google: Tips to get more reviews' },
    { id: 'reply-reviews', text: 'Reply to your reviews, good and bad, briefly and politely.',
      why: 'Google says replies should be clear and helpful, short, conversational rather than promotional, and should never share a reviewer\'s private information or attack them personally. For a negative review it says a genuine apology can go a long way in rebuilding trust.',
      source: REVIEWS, sourceName: 'Google: Tips to get more reviews' },
    { id: 'owner-access', text: 'Check who holds owner access, and remove anyone who has left.',
      why: 'Google says owners can add or remove users and even delete the profile, and that only owners can remove other owners and managers. A former staff member left on the list keeps their access, so I suggest checking the list whenever someone leaves, and making sure the profile is not tied to one person\'s private account. Google says that if you are the primary owner you cannot remove yourself until you transfer primary ownership, so I suggest at least two people you trust know how to reach it.',
      source: USERS, sourceName: 'Google: Manage your Business Profile owners and managers' },
    { id: 'scam-calls', text: 'Know what a real call from Google sounds like, and hang up on fakes.',
      why: 'Google says it will never ask you for payment information over the phone or guarantee a special spot in its products, and that you will not be asked to sign up for a service, pay money or give personal info. If someone pretending to be from Google calls, Google says to hang up and not press any buttons. I suggest telling whoever answers your phone.',
      source: SCAMS, sourceName: 'Google: Help protect against fraudulent calls and texts' }
  ];

  function score(tickedIds) {
    var ticked = Object.create(null);
    (Array.isArray(tickedIds) ? tickedIds : []).forEach(function (id) { if (typeof id === 'string') ticked[id] = true; });
    var total = ITEMS.length, done = 0, next = [];
    ITEMS.forEach(function (it) {
      if (ticked[it.id]) done++;
      else if (next.length < 3) next.push(it);
    });
    var verdict = done >= total ? 'all-done' : (done / total >= 0.5 ? 'most-done' : 'started');
    return { done: done, total: total, next: next, verdict: verdict };
  }

  return { ITEMS: ITEMS, score: score };
});
