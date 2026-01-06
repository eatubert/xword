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

    $transform(sst.aws.Function, (args, opts) => {
      args.runtime = "nodejs22.x";
    });

    const bucket = new sst.aws.Bucket("XWordBucket");

    new sst.aws.React("XWordApp", {
      domain: process.env.DOMAIN,
      link: [bucket],
      server: {
        runtime: "nodejs22.x",
      },
    });

    return {
      XWordBucket: bucket.name,
    };
  },
});
