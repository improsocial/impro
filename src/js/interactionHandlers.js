import { EventEmitter } from "/js/eventEmitter.js";
import { PostInteractionHandler } from "/js/postInteractionHandler.js";
import { ProfileInteractionHandler } from "/js/profileInteractionHandler.js";
import { FeedInteractionHandler } from "/js/feedInteractionHandler.js";

function loggedOutHandler(name) {
  const emitter = new EventEmitter();
  return new Proxy(emitter, {
    get(target, prop) {
      if (prop in target) return target[prop];
      throw new Error(`${name}.${String(prop)} called while logged out`);
    },
  });
}

export class InteractionHandlers extends EventEmitter {
  constructor({ session, dataLayer, postComposerService, reportService }) {
    super();
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
    for (const handler of [
      this.postInteractionHandler,
      this.profileInteractionHandler,
      this.feedInteractionHandler,
    ]) {
      handler.on("requestRender", () => this.emit("requestRender"));
    }
  }
}
