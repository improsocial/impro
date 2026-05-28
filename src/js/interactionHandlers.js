import { PostInteractionHandler } from "/js/postInteractionHandler.js";
import { ProfileInteractionHandler } from "/js/profileInteractionHandler.js";
import { FeedInteractionHandler } from "/js/feedInteractionHandler.js";

function loggedOutHandler(name) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(`${name}.${String(prop)} called while logged out`);
      },
    },
  );
}

export class InteractionHandlers {
  constructor({ session, dataLayer, postComposerService, reportService }) {
    this.postInteractionHandler = session
      ? new PostInteractionHandler(
          dataLayer,
          postComposerService,
          reportService,
        )
      : loggedOutHandler("postInteractionHandler");
    this.profileInteractionHandler = session
      ? new ProfileInteractionHandler(dataLayer, reportService)
      : loggedOutHandler("profileInteractionHandler");
    this.feedInteractionHandler = session
      ? new FeedInteractionHandler(dataLayer)
      : loggedOutHandler("feedInteractionHandler");
  }
}
