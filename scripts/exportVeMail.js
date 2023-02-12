const Yardim = require("../models/yardimModel");
const YardimEt = require("../models/yardimEtModel");
const YardimKaydi = require("../models/yardimKaydiModel");
const Iletisim = require("../models/iletisimModel");
const config = require("../config");
const fs = require("fs");
const sgMail = require("@sendgrid/mail");
const mongoose = require('mongoose');
let emailProviderSetup = false;

if (config.emailProviderAPIKey && config.emailProviderAPIKey !== "") {
  emailProviderSetup = true;
  sgMail.setApiKey(config.emailProviderAPIKey);
}

async function main() {
  const args = process.argv;

  if (args.length < 4) {
    console.log("Kullanim sekli:\n");
    console.log("node scripts/exportVeMail.js modelIsmi islem=islemAdi (dosyaKonumu)");
    return;
  }

  let veriTipi = args[2];
  let islem = args[3].split("=")[1];
  const mailler = config.exportEmails;

  await mongoose.connect(config.mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  switch (islem) {
    case "mail":
      let data = await exportData(veriTipi);
      await sendEmail(mailler, veriTipi, data);

      break;
    case "export":
      let dosyaIsmi = args[4];
      if (!dosyaIsmi) {
        console.error("Export islemi icin lutfen bir dosya ismi belirtin");
        break;
      }

      const writeStream = fs.createWriteStream(dosyaIsmi);
      await exportData(veriTipi, writeStream);
      break;
    case "print":
      let dataToPrint = await exportData(veriTipi);

      console.log("Export edilmis CSV formatinda data: \n");
      console.log(dataToPrint);
      break;
    default:
      console.error("Tanimlanmayan islem tipi girdiniz.");
  }

  mongoose.connection.close();
}

main();

function sendEmail(to, veriTipi, data) {
  if (!data || data.length === 0) {
    console.error("Email atilacak data bos.");
    return;
  }
  let multipleEmail = to.split(",");
  if (multipleEmail.length > 0) {
    to = multipleEmail;
  }

  // Simdilik SendGrid free trier kullanabiliriz, ardindan istenilen saglayiciya gecilebilir
  const msg = {
    to: to,
    from: 'depremiotest@gmail.com',
    subject: `deprem.io ${veriTipi} Export`,
    html: '<strong>deprem.io ciktilari ektedir.</strong>',
    attachments: [
      {
        content: Buffer.from(data).toString("base64"),
        filename: `${veriTipi} export ${Date.now()}.csv`,
        type: "text/csv",
        disposition: "attachment",
        content_id: "depremio_csv"
      }
    ]
  }

  return sgMail
    .send(msg)
    .then((response) => {
      console.log(`Email saglayici durum kodu: ${response[0].statusCode}`);
      console.log(`Email saglayici cevap headerlari: ${response[0].headers}`);
    })
    .catch((error) => {
      console.error(error)
    });
}

async function exportData(veriTipi, io) {
  let select;
  let queryDoc;

  if (veriTipi === "YardimEt") {
    select = "yardimTipi adSoyad telefon sehir hedefSehir aciklama fields createdAt updatedAt";
    queryDoc = YardimEt;
  } else if (veriTipi === "Yardim") {
    select = "yardimTipi adSoyad telefon email adres adresTarifi acilDurum kisiSayisi yardimDurumu fizikiDurum " +
      "googleMapLink tweetLink fields createdAt updatedAt";
    queryDoc = Yardim;
  } else if (veriTipi === "YardimKaydi") {
    select = "yardimTipi adSoyad telefon sonDurum adres email aciklama createdAt updatedAt";
    queryDoc = YardimKaydi;
  } else if (veriTipi === "Iletisim") {
    select = "adSoyad email telefon mesaj createdAt updatedAt";
    queryDoc = Iletisim;
  } else {
    return "";
  }

  let data = await queryDoc.find({})
    .select(select)
    .then(data => {
      return data;
    })
    .catch((err) => {
      console.error(err);
      mongoose.connection.close();
    });

  data = processData(data, io);

  if (io) {
    io.end();
  }
  return data;
}

const header = (obj) => {
  if (!obj) return "";
  let keys = [];

  for (let key of Object.keys(obj)) {
    if (typeof (obj[key]) === "object") {
      let headerName = header(obj[key]);
      if (headerName && headerName.trim() !== "") {
        keys.push(headerName);
      }
    } else {
      if (key && key.trim() !== "") {
        keys.push(key);
      }
    }
  }

  return keys.length > 0 ? keys.join(", ") : "";
};

const row = (obj) => {
  if (!obj) return "";
  let values = [];

  for (let key of Object.keys(obj)) {
    if (typeof (obj[key]) === "object") {
      let value = row(obj[key]);
      if (value) {
        values.push(value);
      }
    } else {
      let value = obj[key].replaceAll(",", " "); // separator keyword
      if (value) {
        values.push(value);
      }
    }
  }

  return values.length > 0 ? values.join(", ") : "";
};

const processData = (data, io) => {
  if (!data || data.length === 0) {
    return "";
  }

  let csvExportString = "";
  let headerString = header(data[0]._doc) + "\n";
  csvExportString += headerString;

  if (io) {
    io.write(headerString, err => {
      if (err) {
        console.error(err);
      }
    });
  }

  data.forEach(dataItem => {
    let rowString = row(dataItem._doc) + "\n";
    if (io) {
      io.write(rowString, err => {
        if (err) {
          console.error(err);
        }
      });
    }
    csvExportString += rowString;
  });

  return csvExportString;
}