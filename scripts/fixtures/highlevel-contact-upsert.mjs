// Representative of the documented HighLevel v2021-07-28 response, not a
// captured response from the failed live run (its HTTP body was not retained).
// https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/contacts/upsert-contact/
export function highLevelUpsertFixture(input, created = true) {
  return { new: created, contact: { id: 'fixture-contact', locationId: 'fixture-location',
    firstName: input.firstName, lastName: input.lastName, email: input.email, phone: null }, traceId: 'fixture-trace' };
}
