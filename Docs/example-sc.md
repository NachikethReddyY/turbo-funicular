1. XSS Vulnerability 1 (Detailed Explanation)
ІЇ.
In the app.js program, in creating reviews and storing them in the database, there is no input
validation and output sanitization, posing a severe security risk to XSS attacks.
When there is a malicious content in the user input for creating review (for example,
<script>alert("test"</script>; ), it will be stored as a review directly to the database. This script,
stored in database is executed every time any user accesses the affected part of the web page.
The level of risk regarding this attack is high since all the users are vulnerable to it.
Type of Flaw Detected
The flaw detected is Stored Cross-Site Scripting (XSS). This occurs when user input is not
properly sanitized and stored in the database. When the affected content is viewed, this data is
retrieved, and executed in the user's browser, leading the user vulnerable to malicious activities.
How It Can Be Exploited Specifically
Stored XSS can be exploited in the following way:
• The attacker submits a malicious input in creating review.
• The script is stored in database.
• Whenever any user views the game reviews, the stored script is executed in their
browsers, leading to session hijacking, redirection to malicious sites or executing
unauthorized activities.
Below is the demonstration of how it can be exploited.
Malicious script is submitted.

Image

Script is stored in database.

Image

Whenever a user enters the review page, the script is executed. Alert keeps persistent no matter
which game the user goes to. It is because the executed script is stored in the database and is
retrieved every time any user accesses the affected content.

image

Identify Code Snippet Exposing the Vulnerability
In app.js, in creating review, no validation is used to check the user input "content", and
thereby, allowing all types of inputs including malicious ones, making it vulnerable to XSS
injection.

iv.
Recommendations
v.
To address the stored XSS vulnerability:
Validate Input : Ensure that user input does not contain any malicious content before
storing in database.
• Sanitize Output : Escape any data retrieved from the database before being displayed on
the web page.
• Utilize Security Libraries : Utilize libraries like 'validator' to escape potentially dangerous
characters in user input.
Code Snippet to Solve the Vulnerability
Here is how to solve this vulnerability:
1. Create validateFns.js for input validation and output sanitization. Write validateReview in
validateFns.js to only accept alphabets(upper and lower case), numbers and spaces.
validateReview: function (raq, res, next) f
Hidden
and spaces allowed!' });
validateSearchInput: function (reg, res, next) f
10
2. Use validateReview as middleware in app.js.
/POST /user/:uid/game/:gid/review
/User add revira to game
app.post('/users/:uid/game/:gid/review',validatefn.validateReview, function (req, res) {
var userid - req.params.uid:
3. Write sanitizeResult in validateFns.js to sanitize the output.
sanitizeResult: function (result) f
ult
Hidden
4. Use sanitizeResult in app.js.
else J
Hidden
DA
After solving,
Testing:
Now, even if the attacker submits a malicious review, it will return status 500 and the review will
not be stored in the database.

vi.
Tools and methods employed to test the web system
• Manual Testing: Manually enter script tags in the review form to check if they are stored
and executed.
• Code review: Performed a through review of the codebase to identify potential XSS
vulnerabilitiess.