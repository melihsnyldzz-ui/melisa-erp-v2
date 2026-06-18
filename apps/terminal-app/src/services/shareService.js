import { Linking, Share } from 'react-native';

export function formatProductShareMoney(value, currency = 'TRY') {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || 'TRY'}`;
}

export function buildProductWhatsappText(product = {}) {
  const stockCode = product.stockCode || product.productCode || '-';
  const productName = product.productName || product.name || '-';
  const price = formatProductShareMoney(product.salePrice ?? product.price, product.currency || 'TRY');

  return [
    `✨ *${stockCode}* ✨`,
    `🧸 ${productName}`,
    `💰 *Fiyat:* ${price}`,
  ].join('\n');
}

export async function shareProductText(product) {
  const message = buildProductWhatsappText(product);
  await Share.share({ message });
  return message;
}

export async function openWhatsappProductShare(product) {
  const message = buildProductWhatsappText(product);
  const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
  const canOpen = await Linking.canOpenURL(url);

  if (canOpen) {
    await Linking.openURL(url);
    return message;
  }

  await Share.share({ message });
  return message;
}
