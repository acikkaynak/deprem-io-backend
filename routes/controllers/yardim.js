const check = new (require("../../lib/Check"))();
const { checkConnection, validateModel} = require("../utils");
const Yardim = require("../../models/yardimModel");
const YardimKaydi = require("../../models/yardimKaydiModel");

const LIST_PREFIX = "yardim_list";

module.exports = async function (fastifyInstance) {
  fastifyInstance.get(
    "/yardim",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            page: {
              type: "number",
              default: 1,
            },
            limit: {
              type: "number",
              default: 10,
            },
            yardimTipi: {
              type: "string",
            },
          },
          required: [],
        },
        description: "Yardim listesi",
      },
    },
    async function (req, res) {
      const { page, limit, yardimTipi } = req.query;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const results = {};

      let cacheKey = `${LIST_PREFIX}_${page}_${limit}${yardimTipi}`;

      const cacheResult = await fastifyInstance.cache.get(cacheKey);
      if (cacheResult?.item) {
        return cacheResult.item;
      }

      await checkConnection(fastifyInstance);
      if (endIndex < (await Yardim.countDocuments().exec())) {
        results.next = {
          page: page + 1,
          limit,
        };
      }

      if (startIndex > 0) {
        results.previous = {
          page: page - 1,
          limit,
        };
      }

      let query = yardimTipi ? { yardimTipi } : {};

      results.totalPage = Math.ceil((await Yardim.countDocuments(query)) / limit);
      results.data = await Yardim.find(query).sort({ _id: -1 }).limit(limit).skip(startIndex).exec();

      results.data = results.data.map((yardim) => {
        if (yardim.email) {
          yardim.email = check.hideEmailCharacters(yardim.email);
        }

        try {
          yardim.telefon = yardim.telefon.replace(/.(?=.{4})/g, "*");
          const names = yardim.adSoyad.split(" ");
          if (names.length > 1) {
            yardim.adSoyad = `${names[0].charAt(0)}${"*".repeat(names[0].length - 2)} ${names[1].charAt(0)}${"*".repeat(
              names[1].length - 2,
            )}`;
          }
          const yedekTelefonlar = yardim.yedekTelefonlar;
          if (yedekTelefonlar) {
            yardim.yedekTelefonlar = yedekTelefonlar.map((yedekTelefon) => {
              return yedekTelefon.replace(/.(?=.{4})/g, "*");
            });
          }
        } catch (error) {
          console.log(error);
        }
        return yardim;
      });

      await fastifyInstance.cache.set(cacheKey, results, 1000 * 60 * 60);

      console.log("results");

      return results;
    },
  );

  fastifyInstance.post(
    "/yardim",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            yardimTipi: {
              type: "string",
            },
            adSoyad: {
              type: "string",
            },
            adres: {
              type: "string",
            },
            acilDurum: {
              type: "string",
            },
            telefon: {
              type: "string",
            },
            tweetLink: {
              type: "string",
              pattern: "twitter.com",
            },
            yedekTelefonlar: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
          required: ["yardimTipi", "adSoyad", "adres", "acilDurum"],
        },
      },
    },
    async function (req, res) {
      req.body = check.xssFilter(req.body);

      const { yardimTipi, adSoyad, adres, acilDurum, telefon, yedekTelefonlar } = req.body;

      if (telefon && !check.isPhoneNumber(telefon)) {
        res.statusCode = 400;
        return {
          error: "Lütfen doğru formatta bir telefon numarası giriniz.(örn: 05554443322)",
        };
      }

      if (yedekTelefonlar && yedekTelefonlar.length > 0) {
        if (!check.arePhoneNumbers(yedekTelefonlar)) {
          res.statusCode = 400;
          return {
            error: "Lütfen doğru formatta bir telefon numarası giriniz.(örn: 05554443322)",
          };
        }
      }

      await checkConnection(fastifyInstance);

      // check exist
      const existingYardim = await Yardim.findOne({ adSoyad, adres });
      if (existingYardim) {
        res.statusCode = 409;
        return {
          error: "Bu yardım bildirimi daha önce veritabanımıza eklendi.",
        };
      }

      const fields = {};

      // TODO: Bunlarin hepsini JSON schema'ya tasiyalim.
      for (const key in req.body) {
        if (key.startsWith("fields-")) {
          const fieldName = key.split("-")[1];
          fields[fieldName] = req.body[key];
        }
      }

      // Create a new Yardim document
      const newYardim = new Yardim({
        yardimTipi,
        adSoyad,
        telefon: req.body.telefon || "", // optional fields
        yedekTelefonlar: yedekTelefonlar || "",
        email: req.body.email || "",
        adres,
        acilDurum,
        adresTarifi: req.body.adresTarifi || "",
        yardimDurumu: "bekleniyor",
        kisiSayisi: req.body.kisiSayisi || "",
        fizikiDurum: req.body.fizikiDurum || "",
        tweetLink: req.body.tweetLink || "",
        googleMapLink: req.body.googleMapLink || "",
        ip: req.ip,
        fields: fields || {},
      });

      try {
        await validateModel(newYardim);
      } catch (e) {
        res.statusCode = 400;
        return {
          error: e.message,
        };
      }

      fastifyInstance.selectiveFlush(LIST_PREFIX);

      await newYardim.save();
      return { message: "Yardım talebiniz başarıyla alındı" };
    },
  );

  fastifyInstance.get("/yardim/:id", async (req, res) => {
    let data;

    const cacheKey = `yardim_${req.params.id}`;

    const cacheResult = await fastifyInstance.cache.get(cacheKey);
    if (cacheResult?.item) {
      return cacheResult.item;
    }
    await checkConnection(fastifyInstance);
    let results = await Yardim.findById(req.params.id);
    let yardimKaydi = await YardimKaydi.find({ postId: req.params.id });
    try {
      yardimKaydi.map((yardim) => {
        if (yardim.email) {
          yardim.email = check.hideEmailCharacters(yardim.email);
        }
      });

      results.telefon = results.telefon.replace(/.(?=.{4})/g, "*");
      const yedekTelefonlar = results.yedekTelefonlar;
      if (results.yedekTelefonlar) {
        results.yedekTelefonlar = yedekTelefonlar.map((yedekTelefon) => {
          return yedekTelefon.replace(/.(?=.{4})/g, "*");
        });
      }
    } catch (error) {}

    fastifyInstance.cache.set(
      cacheKey,
      {
        results: results,
        yardimKaydi: yardimKaydi,
      },
      1000 * 60 * 60,
    );
    if (!results) {
      res.statusCode = 404;
      return { status: 404 };
    }

    return {
      results,
      yardimKaydi,
    };
  });

  fastifyInstance.get(
    "/ara-yardim",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            q: { type: "string" },
            yardimDurumu: { type: "string" },
            acilDurum: { type: "string" },
            yardimTipi: { type: "string" },
            aracDurumu: { type: "string" },
          },
          required: [],
        },
      },
    },
    async (req, res) => {
      const queryString = req.query.q || "";
      const yardimDurumuQuery = req.query.yardimDurumu;
      const acilDurumQuery = req.query.acilDurum;
      const helpType = req.query.yardimTipi;
      const vehicle = req.query.aracDurumu;

      if (!(queryString || yardimDurumuQuery || acilDurumQuery || helpType || vehicle)) {
        res.statusCode = 400;
        return {
          error: "Lütfen en az bir adet filtre giriniz.",
        };
      }

      let query = {
        $or: [
          { adSoyad: { $regex: queryString, $options: "i" } },
          { telefon: { $regex: queryString, $options: "i" } },
          { sehir: { $regex: queryString, $options: "i" } },
          { adresTarifi: { $regex: queryString, $options: "i" } },
        ],
      };

      if (helpType) {
        query = {
          $and: [query, { yardimTipi: helpType }],
        };
      }

      if (vehicle) {
        q1 = {
          $or: [
            {
              fields: {
                aracDurumu: vehicle,
                kvkk: "",
              },
            },
            {
              fields: {
                aracDurumu: vehicle,
                kvkk: "on",
              },
            },
          ],
        };

        query = {
          $and: [query, q1],
        };
      }

      if (yardimDurumuQuery) {
        query = {
          $and: [query, { yardimDurumu: yardimDurumuQuery }],
        };
      }

      if (acilDurumQuery) {
        query = {
          $and: [query, { acilDurum: acilDurumQuery }],
        };
      }
      let results = {};
      results.data = await Yardim.find(query);
      results.data = results.data.map((yardim) => {
        if (yardim.email) {
          yardim.email = check.hideEmailCharacters(yardim.email);
        }
        try {
          yardim.telefon = yardim.telefon.replace(/.(?=.{4})/g, "*");
          const names = yardim.adSoyad.split(" ");
          if (names.length > 1) {
            yardim.adSoyad = `${names[0].charAt(0)}${"*".repeat(names[0].length - 2)} ${names[1].charAt(0)}${"*".repeat(
              names[1].length - 2,
            )}`;
          }
          const yedekTelefonlar = yardim.yedekTelefonlar;
          if (yedekTelefonlar) {
            yardim.yedekTelefonlar = yedekTelefonlar.map((yedekTelefon) => {
              return yedekTelefon.replace(/.(?=.{4})/g, "*");
            });
          }
        } catch (error) {}
        return yardim;
      });
      return results.data;
    },
  );
};
