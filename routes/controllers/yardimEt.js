const check = new (require("../../lib/Check"))();
const { checkConnection, validateModel } = require("../utils");
const YardimEt = require("../../models/yardimEtModel");
const YardimKaydi = require("../../models/yardimKaydiModel");

/**
 * @param {FastifyInstance} fastifyInstance
 */
module.exports = async function (fastifyInstance) {
  fastifyInstance.post(
    "/yardimet",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            yardimTipi: { type: "string" },
            adSoyad: { type: "string" },
            telefon: {
              type: "string",
            },
            sehir: {
              type: "string",
            },
            yedekTelefonlar: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
          required: ["yardimTipi", "adSoyad", "sehir"],
        },
      },
    },
    async function (req, res) {
      req.body = check.xssFilter(req.body);
      const { yardimTipi, adSoyad, telefon, sehir, yedekTelefonlar } = req.body;

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
      const existingYardim = await YardimEt.findOne({
        adSoyad,
        sehir,
        telefon,
      });
      if (existingYardim) {
        res.statusCode = 409;
        return {
          error: "Bu yardım bildirimi daha önce veritabanımıza eklendi.",
        };
      }
      const fields = {};

      // TODO: Bunlari JSON schema'ya tasiyalim.
      for (const key in req.body) {
        if (key.startsWith("fields-")) {
          const fieldName = key.split("-")[1];
          fields[fieldName] = req.body[key];
        }
      }

      // Create a new Yardim document
      let hedefSehir = req.body.hedefSehir || "";
      const newYardim = new YardimEt({
        yardimTipi,
        adSoyad,
        telefon,
        sehir,
        ilce: req.body.ilce || "",
        hedefSehir,
        yardimDurumu: req.body.yardimDurumu || "",
        yedekTelefonlar,
        aciklama: req.body.aciklama || "",
        tweetLink: req.body.tweetLink || "",
        googleMapLink: req.body.googleMapLink || "",
        fields: fields || {},
        ip: req.ip,
      });

      try {
        await validateModel(newYardim);
      } catch (e) {
        res.statusCode = 400;
        return {
          error: e.message,
        };
      }

      await fastifyInstance.flush();
      await newYardim.save();
      return { message: "Yardım talebiniz başarıyla alındı" };
    },
  );

  fastifyInstance.get(
    "/yardimet",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            page: { type: "number", default: 1 },
            limit: { type: "number", default: 10 },
            yardimTipi: { type: "string" },
            sehir: { type: "string" },
            hedefSehir: { type: "string" },
          },
          required: [],
        },
      },
    },
    async function (req, res) {
      const { page, limit, yardimTipi, sehir, hedefSehir } = req.query;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      let data;
      let results = {};

      const cacheKey = `yardimet_${page}_${limit}${yardimTipi}${sehir}${hedefSehir}`;

      if (cache.getCache().has(cacheKey)) {
        return cache.getCache().get(cacheKey);
      }
      await checkConnection(fastifyInstance);

      if (endIndex < (await YardimEt.countDocuments().exec())) {
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

      const searchQuery = yardimTipi ? { yardimTipi } : {};

      if (hedefSehir) searchQuery.hedefSehir = hedefSehir;
      if (sehir) searchQuery.sehir = sehir;

      results.totalPage = Math.ceil((await YardimEt.countDocuments(searchQuery)) / limit);

      results.data = await YardimEt.find(searchQuery).sort({ _id: -1 }).limit(limit).skip(startIndex).exec();
      results.data = results.data.map((yardim) => {
        try {
          //console.log('res: '+Object.values(results));
          yardim.telefon = yardim.telefon.replace(/.(?=.{4})/g, "*");
          const names = yardim.adSoyad.split(" ");
          if (names.length > 0) {
            const name = names[0];
            const surname = names[names.length - 1];
            // hidden name and surname
            yardim.adSoyad = `${name[0]}${"*".repeat(name.length - 1)} ${surname[0]}${"*".repeat(surname.length - 1)}`;
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

      cache.getCache().set(cacheKey, results);

      return results;
    },
  );

  fastifyInstance.get("/yardimet/:id", async (req, res) => {
    const cacheKey = `yardimet_${req.params.id}`;

    if (cache.getCache().has(cacheKey)) {
      return cache.getCache().get(cacheKey);
    }
    await checkConnection(fastifyInstance);
    const results = await YardimEt.findById(req.params.id);
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

    cache.getCache().set(cacheKey, {
      results,
      yardimKaydi,
    });

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
    "/ara-yardimet",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            q: { type: "string" },
            yardimDurumu: { type: "string" },
            helpType: { type: "string" },
            location: { type: "string" },
            hedefSehir: { type: "string" },
          },
          required: [],
        },
      },
    },
    async (req, res) => {
      const queryString = req.query.q;
      const yardimDurumuQuery = req.query.yardimDurumu;
      const helpType = req.query.yardimTipi || "";
      const location = req.query.sehir || "";
      const dest = req.query.hedefSehir || "";
      let query = {
        $or: [{ adSoyad: { $regex: queryString, $options: "i" } }, { telefon: { $regex: queryString, $options: "i" } }],
      };

      if (helpType) {
        query = {
          $and: [query, { yardimTipi: helpType }],
        };
      }

      if (location) {
        query = {
          $and: [query, { sehir: location }],
        };
      }

      if (dest) {
        query = {
          $and: [query, { hedefSehir: dest }],
        };
      }

      if (yardimDurumuQuery) {
        query = {
          $and: [query, { yardimDurumu: yardimDurumuQuery }],
        };
      }
      let results = {};
      results.data = await YardimEt.find(query);

      // hidden phone number for security
      results.data = results.data.map((yardim) => {
        try {
          // console.log('res: '+Object.values(results));
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
