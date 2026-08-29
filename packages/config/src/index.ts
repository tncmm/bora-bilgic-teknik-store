export const appConfig = {
  name: 'Bora Bilgic Teknik',
  apiBaseUrl: 'http://localhost:4010/api/v1',
  // Shipped orders surface a "track your parcel" button that lands on the
  // carrier's public tracking page; the tracking number itself arrives by
  // SMS from the carrier, so we do not store or display it.
  cargoTrackingUrl: 'https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula',
};
