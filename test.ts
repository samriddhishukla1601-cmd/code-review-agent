// test.ts
function calculateTotal(price: any, tax: any) {
    // intentional very bad practice / bug
    return price * tax;
}