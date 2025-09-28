import {
    Test,
    expect,
    prettify,
  } from "tiny-jest";


//   const { it, run, title } = new Test("basic");

//   it("2+2=4", () => {
//     expect(2 + 2).toBe(4);
//   });

//   run().then(prettify);



  const { it, run, title, before, after } = new Test("name-of-your-test");

before(async () => {
  // some setup
});
after(async () => {
  // some cleanup
});

it("toBe", () => {
  expect(2 + 2).toBe(4);
  expect(2 + 2).not.toBe(5);
});

it("toEqual", () => {
  expect(2 + 2).toEqual("4");
  expect(2 + 2).not.toEqual("5");
});

it("toBeTruthy", () => {
  expect(0).toBeFalsy();
  expect(1).toBeFalsy();
});

it("toBeFalsy", () => {
  expect(1).toBeTruthy();
});

it("toMatchObject", () => {
  expect({
    fullName: {
      givenName: "John",
      familyName: "Doe",
    },
  }).toMatchObject({
    fullName: {
      givenName: "John",
    },
  });
  expect({
    givenName: "John",
    familyName: "Doe",
  }).not.toMatchObject({
    fullName: {
      givenName: "John",
    },
  });
});

run().then(prettify);

module.exports = 9