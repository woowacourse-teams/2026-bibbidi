const path = require("path");

const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const webpack = require("webpack");

require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
  quiet: true,
});

function getSiteOrigin(value = process.env.FE_SERVICE_URL) {
  const siteUrl = new URL(value?.trim() || "http://localhost:3000");

  if (siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") {
    throw new Error("FE_SERVICE_URL은 HTTP 또는 HTTPS URL이어야 합니다.");
  }

  return siteUrl.origin;
}

module.exports = (_environment, arguments_) => {
  const isProduction = arguments_.mode === "production";
  const apiBaseUrl = process.env.BIBBIDI_API_BASE_URL ?? "";
  const apiProxyTarget = process.env.BIBBIDI_API_PROXY_TARGET;
  const googleAnalyticsMeasurementId =
    process.env.BIBBIDI_GA_MEASUREMENT_ID ?? "";
  const posthogEnabled = process.env.BIBBIDI_POSTHOG_ENABLED === "true";

  if (!isProduction && !apiProxyTarget) {
    throw new Error("BIBBIDI_API_PROXY_TARGET 환경변수가 필요합니다.");
  }

  return {
    mode: isProduction ? "production" : "development",
    entry: "./src/index.tsx",
    devtool: isProduction ? false : "eval-cheap-module-source-map",

    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "assets/[name].[contenthash:8].js",
      chunkFilename: "assets/[name].[contenthash:8].chunk.js",
      publicPath: "/",
      clean: true,
    },

    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      // 비활성 배포에는 초기화뿐 아니라 SDK 코드 자체도 포함하지 않는다.
      alias: posthogEnabled ? {} : { "posthog-js$": false },
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: "ts-loader",
        },
        {
          test: /\.css$/i,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : "style-loader",
            "css-loader",
          ],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: "asset/resource",
          generator: {
            filename: "assets/[name].[contenthash:8][ext][query]",
          },
        },
      ],
    },

    plugins: [
      new HtmlWebpackPlugin({
        favicon: "./src/assets/bibbidi-favicon.png",
        siteOrigin: getSiteOrigin(),
        template: "./public/index.html",
        minify: isProduction,
      }),
      new webpack.DefinePlugin({
        __BIBBIDI_POSTHOG_ENABLED__: JSON.stringify(posthogEnabled),
        __BIBBIDI_POSTHOG_PROJECT_TOKEN__: JSON.stringify(
          process.env.BIBBIDI_POSTHOG_PROJECT_TOKEN ?? "",
        ),
        __BIBBIDI_POSTHOG_HOST__: JSON.stringify(
          process.env.BIBBIDI_POSTHOG_HOST ?? "https://us.i.posthog.com",
        ),
        __BIBBIDI_APP_ENV__: JSON.stringify(
          process.env.BIBBIDI_APP_ENV ??
            (isProduction ? "production" : "development"),
        ),
        __BIBBIDI_APP_VERSION__: JSON.stringify(
          process.env.BIBBIDI_APP_VERSION ??
            process.env.CODEBUILD_RESOLVED_SOURCE_VERSION ??
            "unknown",
        ),
        __BIBBIDI_API_BASE_URL__: JSON.stringify(apiBaseUrl),
        __BIBBIDI_GA_MEASUREMENT_ID__: JSON.stringify(
          googleAnalyticsMeasurementId,
        ),
      }),
      ...(isProduction
        ? [
            new MiniCssExtractPlugin({
              filename: "assets/[name].[contenthash:8].css",
              chunkFilename: "assets/[name].[contenthash:8].chunk.css",
            }),
          ]
        : []),
    ],

    optimization: {
      runtimeChunk: "single",
      splitChunks: {
        chunks: "all",
      },
    },

    devServer: {
      port: 3000,
      hot: true,
      open: true,
      historyApiFallback: true,
      ...(apiProxyTarget
        ? {
            proxy: [
              {
                changeOrigin: true,
                context: "/api",
                target: apiProxyTarget,
              },
            ],
          }
        : {}),
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
      },
    },

    performance: {
      hints: isProduction ? "warning" : false,
    },

    stats: "errors-warnings",
  };
};
