const { checkConnection } = require("../utils");
const Yardim = require("../../models/yardimModel");
const check = new (require("../../lib/Check"))();
const YardimKaydi = require("../../models/yardimKaydiModel");
const cache = require("../../cache");

module.exports = async function (fastifyInstance) {
  fastifyInstance.post(
    "/ekleYardimKaydi",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            postId: { type: "string" },
            adSoyad: { type: "string" },
            sonDurum: { type: "string" },
            email: { type: "string" },
            aciklama: { type: "string" },
            telefon: { type: "string" },
          },
          required: ["postId"],
        },
      },
    },
    async (req, res) => {
      req.body = check.xssFilter(req.body);
      await checkConnection(fastifyInstance);
      const existingYardimKaydi = await Yardim.findOne({
        _id: req.body.postId,
      });
      if (existingYardimKaydi) {
        if (req.body.telefon) {
          if (req.body.telefon.trim().replace(/ /g, "")) {
            if (!check.isPhoneNumber(req.body.telefon)) {
              res.statusCode = 400;
              return {
                error: "Lütfen doğru formatta bir telefon numarası giriniz.(örn: 05554443322)",
              };
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
        cache.getCache().flushAll();
        await newYardimKaydi.save();
      } else {
        res.statusCode = 400;
        return {
          error: "postId bulunamadı.",
        };
      }

      return { status: 200 };
    },
  );
};
