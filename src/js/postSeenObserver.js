import { wait, throttle } from "/js/utils.js";

const BATCH_TIMEOUT = 2000;

function shallowEqual(a, b) {
  return (
    Object.keys(a).every((key) => a[key] === b[key]) &&
    Object.keys(b).every((key) => a[key] === b[key])
  );
}

class InteractionsDispatch {
  constructor(api, feedProxyUrl) {
    this.feedProxyUrl = feedProxyUrl;
    this.queue = [];
    this.api = api;
    this.inFlight = false;
    this.sentInteractions = [];
  }

  sendInteraction(interaction) {
    if (
      this.sentInteractions.some((sentInteraction) =>
        shallowEqual(sentInteraction, interaction)
      )
    ) {
      console.warn("interaction already sent", interaction);
      return;
    }
    this.queue.push(interaction);
    this.process();
  }

  async process() {
    if (this.inFlight) {
      return;
    }
    this.inFlight = true;
    await wait(BATCH_TIMEOUT);
    try {
      await this.api.sendInteractions(this.queue, this.feedProxyUrl);
      this.sentInteractions.push(...this.queue);
    } catch (error) {
      console.warn(
        "Failed to send interactions to feed proxy url",
        this.feedProxyUrl
      );
    }
    this.queue = [];
    this.inFlight = false;
  }
}

function isVisible(element) {
  return (
    element.getBoundingClientRect().top < window.innerHeight &&
    element.getBoundingClientRect().bottom > 0
  );
}

// export class PostSeenObserver {
//   constructor(api, feedProxyUrl, { verbose = false } = {}) {
//     this.verbose = verbose;
//     this.feedProxyUrl = feedProxyUrl;
//     this.observedElements = new Map();
//     this.feedItemData = new Map(); // map of element -> feed item data
//     this.seenPosts = new Set();
//     this.interactionsDispatch = new InteractionsDispatch(api, feedProxyUrl);
//     this.observer = new IntersectionObserver((entries) => {
//       entries.forEach(async (entry) => {
//         const { feedContext } = this.feedItemData.get(entry.target);
//         if (entry.isIntersecting) {
//           if (!this.feedItemData.has(entry.target)) {
//             console.warn("observed element not found", entry.target);
//             return;
//           }
//           const { postUri, feedContext } = this.feedItemData.get(entry.target);
//           // Must be visible for >=1 second to be considered seen
//           await wait(1000);
//           if (!isVisible(entry.target)) {
//             return;
//           }
//           if (!this.seenPosts.has(postUri)) {
//             if (this.verbose) {
//               console.debug("sending interaction seen", postUri, feedContext);
//             }
//             this.interactionsDispatch.sendInteraction({
//               item: postUri,
//               event: "app.bsky.feed.defs#interactionSeen",
//               feedContext,
//             });
//             this.seenPosts.add(postUri);
//           }
//         }
//       });
//     });
//   }

//   async register(el, postUri, feedContext) {
//     // Don't double-observe posts
//     const existingEl = this.observedElements.get(postUri);
//     if (existingEl) {
//       this.observer.unobserve(existingEl);
//       this.observedElements.delete(existingEl);
//       this.feedItemData.delete(existingEl);
//     }
//     // There needs to be a delay between unobserving and observing
//     await wait(2000);
//     this.observedElements.set(postUri, el);
//     this.feedItemData.set(el, { postUri, feedContext });
//     this.observer.observe(el);
//   }
// }

export class PostSeenObserver {
  constructor(api, feedProxyUrl, { verbose = false } = {}) {
    this.verbose = verbose;
    this.feedProxyUrl = feedProxyUrl;
    this.observedElements = []; // { postUri, el, feedContext }
    this.seenPosts = new Set();
    this.interactionsDispatch = new InteractionsDispatch(api, feedProxyUrl);

    window.addEventListener(
      "scroll",
      throttle(() => {
        this.handleScroll();
      }, 100)
    );
  }

  async checkIntersection(el, postUri, feedContext) {
    if (this.seenPosts.has(postUri)) {
      return;
    }
    if (isVisible(el)) {
      // Must be visible for >=1 second to be considered seen
      await wait(1000);
      // check again to make sure it's still visible, and hasn't been marked seen by another checkIntersection call
      if (!isVisible(el) || this.seenPosts.has(postUri)) {
        return;
      }
      if (this.verbose) {
        console.debug("sending interaction seen", postUri, feedContext);
      }
      this.interactionsDispatch.sendInteraction({
        item: postUri,
        event: "app.bsky.feed.defs#interactionSeen",
        feedContext,
      });
      this.seenPosts.add(postUri);
    }
  }

  checkAllIntersections() {
    this.observedElements.forEach(({ postUri, el, feedContext }) => {
      this.checkIntersection(el, postUri, feedContext);
    });
  }

  handleScroll() {
    this.checkAllIntersections();
  }

  register(el, postUri, feedContext) {
    // don't double-register
    this.observedElements = this.observedElements.filter(
      (item) => item.postUri !== postUri
    );
    this.observedElements.push({ postUri, el, feedContext });
    // check intersections immediately - this is similar to how the intersection observer works
    this.checkIntersection(el, postUri, feedContext);
  }
}
