# deprem-io-backend

Bu proje deprem.io sitesinin backend implementasyonunu icerir.
* **English**: This project includes the implementation of the deprem.io website.

## Requirements

* Docker
* .env dosyasını oluşturunuz içerisine .env-example da yazılanları koyunuz.
* `MONGOURL` env. variable değerini proje leadlerinden isteyiniz


* **English**:
* Create .env file and copy content from .env-example
* Get `MONGOURL` variable value from the project leads

## Local Installment

* Yerel geliştirme için paketlerini kurun
* **English**: Install packages for local development
```
npm run setup
```

* Husky kurulumunu yapın

```bash
npm run prepare
```

* Dockerfile build alınız
* **English**:  Build docker container with following command 
```
docker build -t deprem-io-backend .
```

* Container ı run ediniz
* **English**: Run docker container with following command
```
docker run -p 8080:8080 -d deprem-io-backend
```

* localhost:8080/ adresine gidebiliyorsanız proje ayakta demektir.
* **English**: if you are able to load localhost:8080/ url, good job project is running up.



### Docker ile ayağa kaldırma

```bash
make up
```

## Code Quality

Projede kod kalitesini iyileştirmek için husky paketi kullanılmaktadır. Husky, commit oluşturulmadan önce otomatik olarak format, lint scriptlerini çalıştıracaktır.

## Postman Workspace

https://www.postman.com/minikdev/workspace/depremio

## Yardımları listeleme (GET)

istenen yardımları listeler
/yardim
localhost:8080/yardim?page=1&limit=1

## Yardımiste Ekleme (POST)

Json Yolla
localhost:8080/yardim

- /models/yardimModel.js e bak
  ÖRNEK JSON POSTU

```
{
    "yardimTipi": "Gıda",
    "adSoyad": "John Doe",
    "telefon": "555-555-5555",
    "yedekTelefonlar": ["555-555-5556", "555-555-5557"],
    "email": "johndoe@example.com",
    "adres": "123 Main St",
    "adresTarifi": "2nd floor, apartment 4B",
    "acilDurum": "normal",
    "kisiSayisi": "3",
    "yardimDurumu": "bekleniyor",
    "fizikiDurum": "normal",
    "googleMapLink": "https://maps.google.com/maps?q=123+Main+St",
    "tweetLink": "https://twitter.com/johndoe/status/1234567890",
    "fields-status": "test-status",
    "fields-yenialan": "ekstrabilgi"

}
```

## YardımEt ekleme (GET)

insanların sağladığı yardımları listeler

- localhost:8080/yardimet

YardimTipi filtrelemesi:

- localhost:8080/yardimet?yardimTipi=yolcuTasima

Şehir filtrelemesi:

- localhost:8080/yardimet?sehir=Istanbul

## YardımEt ekleme (POST)

Json Yolla
localhost:8080/yardimet

```
 {
    "yardimTipi": "Yolcu Taşıma",
    "adSoyad": "Jane Doe",
    "telefon": "+1 987 654 3210",
    "sehir": "Istanbul",
    "hedefSehir": "Ankara",
    "aciklama": "Need transportation from Istanbul to Ankara.",
    "fields-status": "test-status",
    "fields-yenialan": "ekstrabilgi",
    "yardimDurumu": "bekleniyor"
}
```

## yardimet (POST)

İstenen yardımların altındaki formlara eklenen yardımkaydi bildirimleri

```
{
"postId": "63e3940d3c12f65e945ff371",
"adSoyad": "Jane Doe",
"telefon": "555-555-5555",
"sonDurum": "yardim-bekleniyor",
"email": "jane.doe@example.com",
"aciklama": "Merhaba, ben Jane Doe. Bu posta yardım etmek istiyorum."
}
```

## export (GET)

Ilgili modelleri duz csv dosyasi olarak download eder

```
http://localhost:8080/export?veriTipi=YardimKaydi
```

## exportStream (GET)

Ilgili modelleri stream csv dosyasi olarak download eder

```
http://localhost:8080/exportStream?veriTipi=YardimKaydi
```

## mailExport (POST)

```
{
"veriTipi": "YardimKaydi",
"mailler": ["halilturkoglucs@gmail.com", "halil@turkoglu.name.tr"]
}
```

## Fields alanını kullanımı

post olarak fields-{burası aalanı adı}: value şeklinde datayı gönderin onunları fields objesi altında birleştirip db ye kayddedecek

örneğin fiels-yardimalani: "ankara" şu şekilde döner

```
fields: {
   yardimalani: "ankara"
}
```

## Not

Opsiyonel her türlü yardım isteme ve yardımEt kısmına eklenecek özellikler için
fields alanını kullanın isteidğiniz gibi json objesi post edebilirsiniz

## Local Email Saglayici Ayari

Export E-Mail ozelligi icin email saglayicinin API key degerini .env dosyasina girmeniz gerekmektedir.

Ayrica email atilmasi istediginiz hesaplari (coklu ise virgul ile ayirarak) asagidaki gibi tanimlayiniz.

e.g.
```.env
EMAIL_PROVIDER_API_KEY="EXAMPLEAPIKEY"
EXPORT_EMAILS="email@example.com"
```

## Cache i temizleme

/cache/flushall

## cache i görme

/cache/getstats

## iletisim (POST)

localhost:8080/iletisim

```
{
    "adSoyad": "John Doe",
    "email": "johndoe@example.com",
    "telefon": "+1 123 456 7890",
    "mesaj": "This is a test message."
}
```

## /ekleYardimKaydi (POST)

istenen yardımların altında form var süreci takip etmek için yardimKaydi olarak ekleyebilirsiniz

```
{
"postId": "63e3940d3c12f65e945ff371",
"adSoyad": "Jane Doe",
"telefon": "555-555-5555",
"sonDurum": "yardim-bekleniyor",
"email": "jane.doe@example.com",
"aciklama": "Merhaba, ben Jane Doe. Bu posta yardım etmek istiyorum."
}
```

## TODO:

- Yeni data eklenince tüm cache i temizliyor onun düzeltilmesi lazım sadece ilgili cache temizlenecek
- İp logging kısmını biri kontrol etsin
- Filter kısmında yazılan queryi isim, adres telefon gibi tüm yerlerde arıyor ama araya boşluk konup birden fazla paramatere yollarsa çalışmaz
- export scriptlerinde fields kısmında bug var ama acil değil kullanılacaksa bakılır şuan çalışıyor

## Endpoint Listsi

- /yardim (POST/GET)
- /yardimet (POST/GET)
- /ara-yardimet (/GET)
- /ara-yardim (GET)
- /yardim/:id (GET)
- /yardimet/:id (GET)
- /iletisim (POST)
- /yardimet (POST)
- /ekleYardimKaydi (POST)

## Scripts

- exportYardimEtCsv.js
  `node scripts/exportYardimEtCsv.js`
  YardimEt datasını csv export eder


## Supply chain security

Avoid running lifecycle scripts from packages 
- added `--ignore-scripts` to Dockerfile.
- installed and configured allow-scripts for development - to only run allowed ones.

run `npx allow-scripts auto` to update the list after new packages with install scripts have been added.