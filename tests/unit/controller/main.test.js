import { afterAll, beforeAll, describe, expect, test } from "vitest";

const buildServer = require("../../../server/build.js");

describe("Main Controller Tests", () => {
  const fastify = buildServer();

  beforeAll(async () => {
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  test("/", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/",
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)["status"]).toBe("up");
  });

  test("/yardim", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/yardim",
    });

    expect(response.statusCode).toBe(200);

    const responseBody = JSON.parse(response.body);

    expect(responseBody).toEqual({
      next: {
        page: expect.any(Number),
        limit: expect.any(Number)
      },
      totalPage: expect.any(Number),
      data: expect.any(Array),
    });
    expect(responseBody.data[0]).toEqual(expect.objectContaining({
      _id: expect.any(String),
      yardimTipi: expect.any(String),
      adSoyad: expect.any(String),
      telefon: expect.any(String),
      yedekTelefonlar: expect.any(Array),
      email: expect.any(String),
      adres: expect.any(String),
      adresTarifi: expect.any(String),
      acilDurum: expect.any(String),
      kisiSayisi: expect.any(String),
      yardimDurumu: expect.any(String),
      fizikiDurum: expect.any(String),
      googleMapLink: expect.any(String),
      tweetLink: expect.any(String),
      fields: expect.any(Object),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      __v: expect.any(Number),
    }))
  });
});
