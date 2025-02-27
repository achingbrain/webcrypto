import crypto from "crypto";
import { JsonParser, JsonSerializer } from "@peculiar/json-schema";
import * as core from "webcrypto-core";
import { HmacCryptoKey } from "./key";
import { ShaCrypto } from "../sha";
import { setCryptoKey, getCryptoKey } from "../storage";

export class HmacProvider extends core.HmacProvider {

  public async onGenerateKey(algorithm: HmacKeyGenParams, extractable: boolean, keyUsages: KeyUsage[]): Promise<CryptoKey> {
    const length = (algorithm.length || this.getDefaultLength((algorithm.hash as Algorithm).name)) >> 3 << 3;
    const key = new HmacCryptoKey();
    key.algorithm = {
      ...algorithm as any,
      length,
      name: this.name,
    };
    key.extractable = extractable;
    key.usages = keyUsages;
    key.data = crypto.randomBytes(length >> 3);

    return setCryptoKey(key);
  }

  public override async onSign(algorithm: Algorithm, key: HmacCryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    const cryptoAlg = ShaCrypto.getAlgorithmName(key.algorithm.hash);
    const hmac = crypto.createHmac(cryptoAlg, getCryptoKey(key).data)
      .update(Buffer.from(data)).digest();

    return new Uint8Array(hmac).buffer;
  }

  public override async onVerify(algorithm: Algorithm, key: HmacCryptoKey, signature: ArrayBuffer, data: ArrayBuffer): Promise<boolean> {
    const cryptoAlg = ShaCrypto.getAlgorithmName(key.algorithm.hash);
    const hmac = crypto.createHmac(cryptoAlg, getCryptoKey(key).data)
      .update(Buffer.from(data)).digest();

    return hmac.compare(Buffer.from(signature)) === 0;
  }

  public async onImportKey(format: KeyFormat, keyData: JsonWebKey | ArrayBuffer, algorithm: HmacImportParams, extractable: boolean, keyUsages: KeyUsage[]): Promise<CryptoKey> {
    let key: HmacCryptoKey;

    switch (format.toLowerCase()) {
      case "jwk":
        key = JsonParser.fromJSON(keyData, { targetSchema: HmacCryptoKey });
        break;
      case "raw":
        key = new HmacCryptoKey();
        key.data = Buffer.from(keyData as ArrayBuffer);
        break;
      default:
        throw new core.OperationError("format: Must be 'jwk' or 'raw'");
    }

    key.algorithm = {
      hash: { name: (algorithm.hash as Algorithm).name },
      name: this.name,
      length: key.data.length << 3,
    };
    key.extractable = extractable;
    key.usages = keyUsages;

    return setCryptoKey(key);
  }

  public async onExportKey(format: KeyFormat, key: HmacCryptoKey): Promise<JsonWebKey | ArrayBuffer> {
    switch (format.toLowerCase()) {
      case "jwk":
        return JsonSerializer.toJSON(getCryptoKey(key));
      case "raw":
        return new Uint8Array(getCryptoKey(key).data).buffer;
      default:
        throw new core.OperationError("format: Must be 'jwk' or 'raw'");
    }
  }

  public override checkCryptoKey(key: CryptoKey, keyUsage?: KeyUsage) {
    super.checkCryptoKey(key, keyUsage);
    if (!(getCryptoKey(key) instanceof HmacCryptoKey)) {
      throw new TypeError("key: Is not HMAC CryptoKey");
    }
  }

}
