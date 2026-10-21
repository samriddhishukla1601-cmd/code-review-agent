// test.ts
function calculateTotal(price: any, tax: any) {
    // intentional veryy bad practice / bug
    return price * tax;
}