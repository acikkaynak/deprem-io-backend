const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const connectDB = require("../mongo-connection");
const Yardim = require("../models/yardimModel");
const cache = require("../cache");
const requestIp = require("request-ip");
const YardimEt = require("../models/yardimEtModel");
const Iletisim = require("../models/iletisimModel");
const YardimKaydi = require("../models/yardimKaydiModel");
const check = new (require("../lib/Check"))();
const validateResource = require("../middleware/validateResource");
const createContactSchema = require("../schema/contactSchema");
const createHelpSchema = require("../schema/helpSchema");
const createAssistantCandidateSchema = require("../schema/assistantCandidateSchema");
const { removeWhiteSpace } = require("../utils");

router.get("/", function (req, res) {
  res.send("depremio backend");
});

router.get("/yardim", async function (req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    let data;

    const yardimTipi = req.query.yardimTipi || "";

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const results = {};

    let cacheKey = `yardim_${page}_${limit}${yardimTipi}`;
    if (cache.getCache().has(cacheKey)) {
      data = cache.getCache().get(cacheKey);
      return res.send(data);
    }

    await checkConnection();
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

    let query = {};
    if (yardimTipi !== "") {
      query.yardimTipi = yardimTipi;
    }

    results.totalPage = Math.ceil((await Yardim.countDocuments(query)) / limit);
    results.data = await Yardim.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .skip(startIndex)
      .exec();

    results.data = results.data.map((yardim) => {
      yardim.telefon = yardim.telefon.replace(/.(?=.{4})/g, "*");
      const names = yardim.adSoyad.split(" ");
      if (names.length > 1) {
        yardim.adSoyad = `${names[0].charAt(0)}${"*".repeat(
          names[0].length - 2
        )} ${names[1].charAt(0)}${"*".repeat(names[1].length - 2)}`;
      }
      const yedekTelefonlar = yardim.yedekTelefonlar;
      if (yedekTelefonlar) {
        yardim.yedekTelefonlar = yedekTelefonlar.map((yedekTelefon) => {
          return yedekTelefon.replace(/.(?=.{4})/g, "*");
        });
      }
      return yardim;
    });
    cache.getCache().set(cacheKey, results);
    if (!data) {
      res.json(results);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not retrieve the Yardim documents" });
  }
});

router.post(
  "/yardim",
  validateResource(createHelpSchema),
  async function (req, res) {
    try {
      const { yardimTipi, adSoyad, adres, acilDurum } = req.body;

      await checkConnection();

      // check exist
      const existingYardim = await Yardim.findOne({ adSoyad, adres });
      if (existingYardim) {
        return res.status(409).json({
          error: "Bu yardım bildirimi daha önce veritabanımıza eklendi.",
        });
      }

      var clientIp = requestIp.getClientIp(req); // on localhost > 127.0.0.1

      const fields = {};

      for (const key in req.body) {
        if (key.startsWith("fields-")) {
          const fieldName = key.split("-")[1];
          fields[fieldName] = req.body[key];
        }
      }

      const yedekTelefonlar = req.body.yedekTelefonlar;

      // Create a new Yardim document
      const newYardim = new Yardim({
        yardimTipi,
        adSoyad,
        telefon: removeWhiteSpace(req.body.telefon) || "", // optional fields
        yedekTelefonlar:
          yedekTelefonlar && yedekTelefonlar.length > 0
            ? yedekTelefonlar.map((telefon) => removeWhiteSpace(telefon))
            : [],
        email: req.body.email || "",
        adres,
        acilDurum,
        adresTarifi: req.body.adresTarifi || "",
        yardimDurumu: "bekleniyor",
        kisiSayisi: req.body.kisiSayisi || "",
        fizikiDurum: req.body.fizikiDurum || "",
        tweetLink: req.body.tweetLink || "",
        googleMapLink: req.body.googleMapLink || "",
        ip: clientIp,
        fields: fields || {},
      });

      cache.getCache().flushAll();
      await newYardim.save();
      res.json({ message: "Yardım talebiniz başarıyla alındı" });
    } catch (error) {
      res.status(500).json({ error: "Hata! Yardım dökümanı kaydedilemedi!" });
    }
  }
);

router.post(
  "/yardimet",
  validateResource(createAssistantCandidateSchema),
  async function (req, res) {
    try {
      const { yardimTipi, adSoyad, sehir } = req.body;

      await checkConnection();

      // check exist
      const existingYardim = await YardimEt.findOne({ adSoyad, sehir });
      if (existingYardim) {
        return res.status(409).json({
          error: "Bu yardım bildirimi daha önce veritabanımıza eklendi.",
        });
      }
      var clientIp = requestIp.getClientIp(req); // on localhost > 127.0.0.1

      const fields = {};

      for (const key in req.body) {
        if (key.startsWith("fields-")) {
          const fieldName = key.split("-")[1];
          fields[fieldName] = req.body[key];
        }
      }

      const yedekTelefonlar = req.body.yedekTelefonlar;
      // Create a new Yardim document
      let hedefSehir = req.body.hedefSehir || "";
      const newYardim = new YardimEt({
        yardimTipi,
        adSoyad,
        telefon: removeWhiteSpace(req.body.telefon) || "", // optional fields
        sehir,
        ilce: req.body.ilce || "",
        hedefSehir,
        yardimDurumu: req.body.yardimDurumu || "",
        yedekTelefonlar:
          yedekTelefonlar && yedekTelefonlar.length > 0
            ? yedekTelefonlar.map((telefon) => removeWhiteSpace(telefon))
            : [],
        aciklama: req.body.aciklama || "",
        tweetLink: req.body.tweetLink || "",
        googleMapLink: req.body.googleMapLink || "",
        fields: fields || {},
        ip: clientIp,
      });

      cache.getCache().flushAll();
      await newYardim.save();
      res.json({ message: "Yardım talebiniz başarıyla alındı" });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        error: "Hata! Yardım dökümanı kaydedilemedi!",
      });
    }
  }
);

router.get("/yardimet", async function (req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const yardimTipi = req.query.yardimTipi || "";
    const sehir = req.query.sehir || "";
    const hedefSehir = req.query.hedefSehir || "";
    let data;

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    let results = {};

    const cacheKey = `yardimet_${page}_${limit}${yardimTipi}${sehir}${hedefSehir}`;

    if (cache.getCache().has(cacheKey)) {
      data = cache.getCache().get(cacheKey);
      return res.send(data);
    }
    await checkConnection();

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

    let searchQuery = {};

    if (yardimTipi !== "") {
      searchQuery = { yardimTipi: yardimTipi };
    }

    if (hedefSehir !== "") {
      searchQuery = { ...searchQuery, hedefSehir: hedefSehir };
    }
    if (sehir !== "") {
      searchQuery = { ...searchQuery, sehir: sehir };
    }

    results.totalPage = Math.ceil(
      (await YardimEt.countDocuments(searchQuery)) / limit
    );

    results.data = await YardimEt.find(searchQuery)
      .sort({ _id: -1 })
      .limit(limit)
      .skip(startIndex)
      .exec();
    results.data = results.data.map((yardim) => {
      yardim.telefon = yardim.telefon.replace(/.(?=.{4})/g, "*");
      const names = yardim.adSoyad.split(" ");

      if (names.length > 0) {
        const name = names[0];
        const surname = names[names.length - 1];
        // hidden name and surname
        yardim.adSoyad = `${name[0]}${"*".repeat(name.length - 1)} ${
          surname[0]
        }${"*".repeat(surname.length - 1)}`;
      }
      const yedekTelefonlar = yardim.yedekTelefonlar;
      if (yedekTelefonlar) {
        yardim.yedekTelefonlar = yedekTelefonlar.map((yedekTelefon) => {
          return yedekTelefon.replace(/.(?=.{4})/g, "*");
        });
      }
      return yardim;
    });

    cache.getCache().set(cacheKey, results);

    if (!data) {
      res.json(results);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not retrieve the Yardim documents!" });
  }
});

router.get("/ara-yardimet", async (req, res) => {
  try {
    const queryString = req.query.q;
    const yardimDurumuQuery = req.query.yardimDurumu;
    const helpType = req.query.yardimTipi || "";
    const location = req.query.sehir || "";
    const dest = req.query.hedefSehir || "";
    let query = {
      $or: [
        { adSoyad: { $regex: queryString, $options: "i" } },
        { telefon: { $regex: queryString, $options: "i" } },
      ],
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
      yardim.telefon = yardim.telefon.replace(/.(?=.{4})/g, "*");
      const names = yardim.adSoyad.split(" ");
      if (names.length > 1) {
        yardim.adSoyad = `${names[0].charAt(0)}${"*".repeat(
          names[0].length - 2
        )} ${names[1].charAt(0)}${"*".repeat(names[1].length - 2)}`;
      }
      const yedekTelefonlar = yardim.yedekTelefonlar;
      if (yedekTelefonlar) {
        yardim.yedekTelefonlar = yedekTelefonlar.map((yedekTelefon) => {
          return yedekTelefon.replace(/.(?=.{4})/g, "*");
        });
      }
      return yardim;
    });
    res.json(results.data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/ara-yardim", async (req, res) => {
  try {
    const queryString = req.query.q || "";
    const yardimDurumuQuery = req.query.yardimDurumu;
    const acilDurumQuery = req.query.acilDurum;
    const helpType = req.query.yardimTipi;
    const vehicle = req.query.aracDurumu;
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
      let q1 = {
        $or: [
          {
            fields: {
              aracDurumu: vehicle,
              kvkk: "on",
            },
          },
          {
            fields: {
              aracDurumu: vehicle,
              kvkk: "",
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
      yardim.telefon = yardim.telefon.replace(/.(?=.{4})/g, "*");
      const names = yardim.adSoyad.split(" ");
      if (names.length > 1) {
        yardim.adSoyad = `${names[0].charAt(0)}${"*".repeat(
          names[0].length - 2
        )} ${names[1].charAt(0)}${"*".repeat(names[1].length - 2)}`;
      }
      const yedekTelefonlar = yardim.yedekTelefonlar;
      if (yedekTelefonlar) {
        yardim.yedekTelefonlar = yedekTelefonlar.map((yedekTelefon) => {
          return yedekTelefon.replace(/.(?=.{4})/g, "*");
        });
      }
      return yardim;
    });
    res.json(results.data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/yardim/:id", async (req, res) => {
  try {
    let data;

    const cacheKey = `yardim_${req.params.id}`;

    if (cache.getCache().has(cacheKey)) {
      data = cache.getCache().get(cacheKey);
      return res.send(data);
    }
    await checkConnection();
    let results = await Yardim.findById(req.params.id);
    try {
      results.telefon = results.telefon.replace(/.(?=.{4})/g, "*");
      const yedekTelefonlar = results.yedekTelefonlar;
      if (results.yedekTelefonlar) {
        results.yedekTelefonlar = yedekTelefonlar.map((yedekTelefon) => {
          return yedekTelefon.replace(/.(?=.{4})/g, "*");
        });
      }
    } catch (error) {}

    let yardimKaydi = await YardimKaydi.find({ postId: req.params.id });

    cache.getCache().set(cacheKey, {
      results: results,
      yardimKaydi: yardimKaydi,
    });
    if (!results) {
      return res.status(404).send("Yardim not found");
    }
    if (!data) {
      res.send({
        results: results,
        yardimKaydi: yardimKaydi,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/yardimet/:id", async (req, res) => {
  try {
    let data;

    const cacheKey = `yardimet_${req.params.id}`;

    if (cache.getCache().has(cacheKey)) {
      data = cache.getCache().get(cacheKey);
      return res.send(data);
    }
    await checkConnection();
    const results = await YardimEt.findById(req.params.id);
    results.telefon = results.telefon.replace(/.(?=.{4})/g, "*");
    const yedekTelefonlar = results.yedekTelefonlar;
    if (results.yedekTelefonlar) {
      results.yedekTelefonlar = yedekTelefonlar.map((yedekTelefon) => {
        return yedekTelefon.replace(/.(?=.{4})/g, "*");
      });
    }
    cache.getCache().set(cacheKey, results);
    if (!results) {
      return res.status(404).send("Yardim not found");
    }
    if (!data) {
      res.send(results);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

router.post(
  "/iletisim",
  validateResource(createContactSchema),
  async function (req, res) {
    try {
      await checkConnection();
      var clientIp = requestIp.getClientIp(req); // on localhost > 127.0.0.1

      const existingIletisim = await Iletisim.findOne({
        adSoyad: req.body.adSoyad,
        email: req.body.email,
        mesaj: req.body.mesaj,
      });

      if (existingIletisim) {
        return res.status(400).json({
          error:
            "Bu iletişim talebi zaten var, lütfen farklı bir talepte bulunun.",
        });
      }
      const telefon = removeWhiteSpace(req.body.telefon);
      // Create a new Yardim document
      const newIletisim = new Iletisim({
        adSoyad: req.body.adSoyad || "",
        email: req.body.email || "",
        telefon: telefon || "",
        mesaj: req.body.mesaj || "",
        ip: clientIp,
      });
      await newIletisim.save();
      res.json({ message: "İletişim talebiniz başarıyla alındı" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Hata! Yardım dökümanı kaydedilemedi!" });
    }
  }
);

router.post("/ekleYardimKaydi", async (req, res) => {
  //const { postId, adSoyad, telefon, sonDurum, email, aciklama } = req.body;
  try {
    await checkConnection();
    const existingYardimKaydi = await YardimKaydi.findById({
      postId: req.body.postId,
    });
    if (existingYardimKaydi) {
      if (req.body.telefon) {
        if (req.body.telefon.trim().replace(/ /g, "")) {
          if (
            !/^\d+$/.test(req.body.telefon) ||
            req.body.telefon.length !== 10
          ) {
            return res.status(400).json({
              error:
                "Telefon numarası sadece rakamlardan ve 10 karakterden oluşmalıdır.",
            });
          }
        }
        req.body.telefon = req.body.telefon.replace(/ /g, "");
      }
      const newYardimKaydi = new YardimKaydi({
        postId: req.body.postId || "",
        adSoyad: req.body.adSoyad || "",
        telefon: req.body.telefon || "",
        sonDurum: req.body.sonDurum || "",
        email: req.body.email || "",
        aciklama: req.body.aciklama || "",
      });
      await newYardimKaydi.save();
    } else {
      return res.status(400).json({
        error: "Bu yardım kaydı zaten var, lütfen farklı bir talepte bulunun.",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Hata! Yardım kaydi kaydedilemedi!" });
  }
});

async function checkConnection() {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
  } catch (error) {
    console.log(error);
  }
}

module.exports = router;
