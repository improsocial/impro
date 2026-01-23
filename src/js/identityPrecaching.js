import { getQuotedPost } from "/js/dataHelpers.js";

export function setUpIdentityPrecaching(dataLayer, identityResolver) {
  // Precache author DIDs when posts are set in the data store
  dataLayer.dataStore.on("setPost", (post) => {
    try {
      if (post.author) {
        identityResolver.setDidForHandle(post.author.handle, post.author.did);
      }
    } catch (error) {
      console.error("error when setting DID from post", post);
      console.error(error);
    }
    // Quoted posts too!
    try {
      const quotedPost = getQuotedPost(post);
      if (quotedPost) {
        if (quotedPost.author) {
          identityResolver.setDidForHandle(
            quotedPost.author.handle,
            quotedPost.author.did,
          );
        }
        // we can go deeper...
        // TODO - normalize quoted posts?
        const nestedQuotedPost = getQuotedPost(quotedPost);
        if (nestedQuotedPost) {
          if (nestedQuotedPost.author) {
            identityResolver.setDidForHandle(
              nestedQuotedPost.author.handle,
              nestedQuotedPost.author.did,
            );
          }
        }
      }
    } catch (error) {
      console.error("error when setting DID from quoted post", post);
      console.error(error);
    }
  });

  // Precache author DIDs when feed generators are set in the data store
  dataLayer.dataStore.on("setFeedGenerator", (feedGenerator) => {
    try {
      if (feedGenerator.creator) {
        identityResolver.setDidForHandle(
          feedGenerator.creator.handle,
          feedGenerator.creator.did,
        );
      }
    } catch (error) {
      console.error(
        "error when setting DID from feed generator",
        feedGenerator,
      );
      console.error(error);
    }
  });

  // Precache author DIDs when profiles are set in the data store
  dataLayer.dataStore.on("setProfileSearchResults", (profileSearchResults) => {
    for (const searchResult of profileSearchResults) {
      identityResolver.setDidForHandle(searchResult.handle, searchResult.did);
    }
  });
}
