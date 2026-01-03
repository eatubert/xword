/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "xword",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: input?.stage === "production",
      home: "aws",
    };
  },
  async run() {
    if (!process.env.DOMAIN) {
      throw new Error("DOMAIN environment variable is required");
    }

    const bucket = new sst.aws.Bucket("XWordBucket");

    new sst.aws.React("XWordApp", {
      domain: process.env.DOMAIN,
      link: [bucket],
    });

    return {
      XWordBucket: bucket.name,
    };
  },
});
