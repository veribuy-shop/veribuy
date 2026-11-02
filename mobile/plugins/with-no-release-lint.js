const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Release builds run lint across every module, and Stripe's optional push
 * provisioning dependency needs a Google library that isn't publicly available,
 * so lint can't start and the build fails. We don't use push provisioning.
 */
module.exports = function withNoReleaseLint(config) {
  return withAppBuildGradle(config, (gradle) => {
    if (!gradle.modResults.contents.includes('checkReleaseBuilds')) {
      gradle.modResults.contents = gradle.modResults.contents.replace(
        /^android \{$/m,
        'android {\n    lint {\n        checkReleaseBuilds false\n    }',
      );
    }
    return gradle;
  });
};
