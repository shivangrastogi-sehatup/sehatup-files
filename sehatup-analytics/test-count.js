fetch('http://localhost:3000/shopify-v2/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "{ customersCount { count } }" })
}).then(res => res.text()).then(console.log).catch(console.error);
