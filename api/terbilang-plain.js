export default function handler(req, res) {
  const { angka } = req.query;

  if (!angka || isNaN(Number(angka.replace(/[,\.]/g, '')))) {
    return res.status(400).send("Input tidak valid");
  }

  const numStr = angka.replace(/\./g, "").replace(",", ".");
  const number = parseFloat(numStr);

  function toTerbilang(n) {
    const satuan = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
    n = Math.floor(n);
    if (n < 12) return satuan[n];
    else if (n < 20) return toTerbilang(n - 10) + " belas";
    else if (n < 100) return toTerbilang(Math.floor(n / 10)) + " puluh " + toTerbilang(n % 10);
    else if (n < 200) return "seratus " + toTerbilang(n - 100);
    else if (n < 1000) return toTerbilang(Math.floor(n / 100)) + " ratus " + toTerbilang(n % 100);
    else if (n < 2000) return "seribu " + toTerbilang(n - 1000);
    else if (n < 1000000) return toTerbilang(Math.floor(n / 1000)) + " ribu " + toTerbilang(n % 1000);
    else if (n < 1000000000) return toTerbilang(Math.floor(n / 1000000)) + " juta " + toTerbilang(n % 1000000);
    else if (n < 1000000000000) return toTerbilang(Math.floor(n / 1000000000)) + " miliar " + toTerbilang(n % 1000000000);
    else if (n < 1000000000000000) return toTerbilang(Math.floor(n / 1000000000000)) + " triliun " + toTerbilang(n % 1000000000000);
    else return "(terlalu besar)";
  }

  let hasil = toTerbilang(number).replace(/\s+/g, " ").trim();

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(200).send(hasil);
}
